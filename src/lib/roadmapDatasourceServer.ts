import 'server-only';
import { sql } from '@/lib/neon';
import type { RoadmapItem } from '@/types/roadmap';
import type {
  AzureDevopsDatasourceConfig,
  RoadmapDatasourceSummary,
  RoadmapDatasourceType,
} from '@/types/roadmapDatasources';
import {
  buildAzureDevopsRequestHeaders,
  getFieldMapForConfig,
  getFieldListForConfig,
  getMaxItems,
  getRefreshMinutes,
  mapAzureDevopsItem,
  normalizeOrganizationUrl,
  resolveDatasourceType,
} from '@/lib/roadmapDatasource';
import { decryptSecret, encryptSecret } from '@/lib/secretStore';

type AzureDevopsComment = {
  id: number;
  text: string;
  createdBy?: { displayName?: string; uniqueName?: string } | null;
  createdDate?: string;
  revisedDate?: string;
};

type AzureDevopsRelation = {
  rel?: string;
  url?: string;
  attributes?: { name?: string; comment?: string };
};

type AzureDevopsWorkItemDetail = {
  id: number;
  fields?: Record<string, unknown>;
};

type DatasourceRecord = {
  roadmap_id: string;
  type: string;
  config_json: string;
  secret_encrypted: string | null;
  last_snapshot_json: string | null;
  last_snapshot_at: string | null;
  last_sync_at: string | null;
  last_sync_duration_ms: number | null;
  last_sync_item_count: number | null;
  last_sync_error: string | null;
};

type FetchResult = {
  items: RoadmapItem[];
  stale: boolean;
  truncated: boolean;
  warning?: string;
};

const parseConfig = (raw: string | null | undefined): Record<string, unknown> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const sanitizeAzureConfig = (input: Record<string, unknown>): AzureDevopsDatasourceConfig => {
  const organizationUrl = typeof input.organizationUrl === 'string' ? input.organizationUrl.trim() : '';
  const project = typeof input.project === 'string' ? input.project.trim() : '';
  const team = typeof input.team === 'string' ? input.team.trim() : null;
  const queryMode = input.queryMode === 'advanced' ? 'advanced' : 'simple';
  const queryTemplate =
    input.queryTemplate === 'stories-active' ||
    input.queryTemplate === 'recently-changed'
      ? input.queryTemplate
      : 'epics-features-active';
  const areaPath = typeof input.areaPath === 'string' ? input.areaPath.trim() : '';
  const workItemTypes = Array.isArray(input.workItemTypes)
    ? input.workItemTypes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];
  const includeClosed = typeof input.includeClosed === 'boolean' ? input.includeClosed : false;
  const stakeholderTagPrefixRaw =
    typeof input.stakeholderTagPrefix === 'string' ? input.stakeholderTagPrefix.trim() : '';
  const regionTagPrefixRaw =
    typeof input.regionTagPrefix === 'string' ? input.regionTagPrefix.trim() : '';
  const stakeholderTagPrefix = stakeholderTagPrefixRaw || 'Stakeholder:';
  const regionTagPrefix = regionTagPrefixRaw || 'Region:';
  const queryType = input.queryType === 'saved' ? 'saved' : 'wiql';
  const queryText = typeof input.queryText === 'string' ? input.queryText.trim() : '';
  const refreshMinutes = typeof input.refreshMinutes === 'number' ? input.refreshMinutes : undefined;
  const maxItems = typeof input.maxItems === 'number' ? input.maxItems : undefined;
  const missingDateStrategy =
    input.missingDateStrategy === 'skip'
      ? 'skip'
      : input.missingDateStrategy === 'unplanned'
        ? 'unplanned'
        : 'fallback';
  const fieldMap = typeof input.fieldMap === 'object' && input.fieldMap ? input.fieldMap : undefined;
  return {
    organizationUrl,
    project,
    team,
    queryMode,
    queryTemplate,
    areaPath,
    workItemTypes,
    includeClosed,
    stakeholderTagPrefix,
    regionTagPrefix,
    queryType,
    queryText,
    refreshMinutes,
    maxItems,
    missingDateStrategy,
    fieldMap,
  };
};

const buildSimpleWiql = (config: AzureDevopsDatasourceConfig) => {
  const whereParts: string[] = [];
  const workItemTypes = config.workItemTypes ?? [];
  const types = workItemTypes.length > 0
    ? workItemTypes
    : config.queryTemplate === 'stories-active'
      ? ['User Story', 'Product Backlog Item']
      : config.queryTemplate === 'recently-changed'
        ? ['Epic', 'Feature', 'User Story', 'Product Backlog Item']
        : ['Epic', 'Feature'];
  whereParts.push(
    `[System.WorkItemType] IN (${types.map((type) => `'${type.replace(/'/g, "''")}'`).join(', ')})`,
  );
  if (!config.includeClosed) {
    whereParts.push(`[System.State] <> 'Closed'`);
  }
  if (config.queryTemplate === 'recently-changed') {
    whereParts.push(`[System.ChangedDate] >= @today - 90`);
  }
  if (config.areaPath) {
    whereParts.push(
      `[System.AreaPath] UNDER '${config.areaPath.replace(/'/g, "''")}'`,
    );
  }
  return `SELECT [System.Id] FROM WorkItems WHERE ${whereParts.join(' AND ')} ORDER BY [System.ChangedDate] DESC`;
};

const buildAzureDevopsWiql = async (
  normalizedUrl: string,
  config: AzureDevopsDatasourceConfig,
  pat: string,
) => {
  if (config.queryMode !== 'advanced') {
    return buildSimpleWiql(config);
  }
  if (config.queryType !== 'saved') {
    return config.queryText;
  }
  const headers = buildAzureDevopsRequestHeaders(pat);
  const queryUrl = `${normalizedUrl}/${encodeURIComponent(config.project)}/_apis/wit/queries/${encodeURIComponent(
    config.queryText,
  )}?api-version=7.1-preview.2`;
  const queryRes = await fetch(queryUrl, { headers });
  if (!queryRes.ok) {
    const errorText = await queryRes.text().catch(() => '');
    throw new Error(`Failed to load saved query (${queryRes.status}). ${errorText}`.trim());
  }
  const queryData = (await queryRes.json()) as { wiql?: string };
  return queryData.wiql ?? '';
};

export async function getDatasourceRecord(
  roadmapId: string,
): Promise<DatasourceRecord | null> {
  const rows = await sql`
    SELECT roadmap_id, type, config_json, secret_encrypted, last_snapshot_json,
           last_snapshot_at, last_sync_at, last_sync_duration_ms, last_sync_item_count,
           last_sync_error
    FROM roadmap_datasources
    WHERE roadmap_id = ${roadmapId}
    LIMIT 1
  `;
  return (rows[0] as DatasourceRecord | undefined) ?? null;
}

export async function ensureDatasourceRow(roadmapId: string) {
  await sql`
    INSERT INTO roadmap_datasources (roadmap_id, type, config_json)
    VALUES (${roadmapId}, 'csv', '{}')
    ON CONFLICT (roadmap_id) DO NOTHING
  `;
}

export function buildDatasourceSummary(record: DatasourceRecord | null): RoadmapDatasourceSummary {
  const type = resolveDatasourceType(record?.type);
  const config = type === 'azure-devops' ? sanitizeAzureConfig(parseConfig(record?.config_json)) : null;
  return {
    type,
    config,
    hasSecret: Boolean(record?.secret_encrypted),
    lastSyncAt: record?.last_sync_at ?? null,
    lastSyncDurationMs: record?.last_sync_duration_ms ?? null,
    lastSyncItemCount: record?.last_sync_item_count ?? null,
    lastSyncError: record?.last_sync_error ?? null,
    lastSnapshotAt: record?.last_snapshot_at ?? null,
  };
}

export async function updateDatasourceRecord(
  roadmapId: string,
  type: RoadmapDatasourceType,
  config: Record<string, unknown>,
  secret: string | null,
) {
  const configJson = JSON.stringify(config ?? {});
  const encrypted = secret ? encryptSecret(secret) : null;

  await sql`
    INSERT INTO roadmap_datasources (roadmap_id, type, config_json, secret_encrypted, last_sync_error)
    VALUES (${roadmapId}, ${type}, ${configJson}, ${encrypted}, NULL)
    ON CONFLICT (roadmap_id)
    DO UPDATE SET
      type = ${type},
      config_json = ${configJson},
      secret_encrypted = COALESCE(${encrypted}, roadmap_datasources.secret_encrypted),
      last_sync_error = NULL
  `;

  if (secret === '') {
    await sql`
      UPDATE roadmap_datasources
      SET secret_encrypted = NULL
      WHERE roadmap_id = ${roadmapId}
    `;
  }
}

const readSnapshot = (record: DatasourceRecord | null): RoadmapItem[] => {
  if (!record?.last_snapshot_json) return [];
  try {
    const parsed = JSON.parse(record.last_snapshot_json);
    return Array.isArray(parsed) ? (parsed as RoadmapItem[]) : [];
  } catch {
    return [];
  }
};

const shouldUseSnapshot = (
  record: DatasourceRecord | null,
  refreshMinutes: number,
  forceRefresh: boolean,
) => {
  if (forceRefresh) return false;
  if (!record?.last_snapshot_at) return false;
  const last = Date.parse(record.last_snapshot_at);
  if (Number.isNaN(last)) return false;
  const ageMinutes = (Date.now() - last) / (60 * 1000);
  return ageMinutes <= refreshMinutes;
};

const fetchAzureDevopsWiql = async (
  baseUrl: string,
  config: AzureDevopsDatasourceConfig,
  pat: string,
  maxItems: number,
): Promise<number[]> => {
  const headers = buildAzureDevopsRequestHeaders(pat);
  const wiql = await buildAzureDevopsWiql(baseUrl, config, pat);

  const wiqlUrl = `${baseUrl}/${encodeURIComponent(config.project)}/_apis/wit/wiql?api-version=7.1-preview.2`;
  const wiqlRes = await fetch(wiqlUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: wiql }),
  });
  if (!wiqlRes.ok) {
    const errorText = await wiqlRes.text().catch(() => '');
    throw new Error(
      `Azure DevOps WIQL query failed (${wiqlRes.status}). ${errorText}`.trim(),
    );
  }
  const wiqlData = (await wiqlRes.json()) as { workItems?: Array<{ id: number }> };
  const ids = (wiqlData.workItems ?? []).map((item) => item.id);
  return ids.slice(0, maxItems);
};

const fetchAzureDevopsItems = async (
  baseUrl: string,
  config: AzureDevopsDatasourceConfig,
  pat: string,
): Promise<{ items: RoadmapItem[]; truncated: boolean }> => {
  const maxItems = getMaxItems(config);
  const ids = await fetchAzureDevopsWiql(baseUrl, config, pat, maxItems);
  const truncated = ids.length >= maxItems;
  if (ids.length === 0) return { items: [], truncated };

  const fields = getFieldListForConfig(config);
  const headers = buildAzureDevopsRequestHeaders(pat);
  const batches: RoadmapItem[] = [];
  const chunkSize = 200;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const batchUrl = `${baseUrl}/${encodeURIComponent(config.project)}/_apis/wit/workitemsbatch?api-version=7.1-preview.1`;
    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: chunk, fields }),
    });
    if (!batchRes.ok) {
      const errorText = await batchRes.text().catch(() => '');
      throw new Error(
        `Azure DevOps work item batch failed (${batchRes.status}). ${errorText}`.trim(),
      );
    }
    const batchData = (await batchRes.json()) as { value?: Array<{ id: number; fields: Record<string, unknown> }> };
    const values = batchData.value ?? [];
    values.forEach((item) => {
      const mapped = mapAzureDevopsItem(baseUrl, config, item);
      if (mapped) batches.push(mapped);
    });
  }

  return { items: batches, truncated };
};

export async function fetchDatasourceItems(
  roadmapId: string,
  forceRefresh: boolean,
): Promise<FetchResult> {
  const record = await getDatasourceRecord(roadmapId);
  const type = resolveDatasourceType(record?.type);

  if (type !== 'azure-devops') {
    const rows = await sql`
      SELECT csv_text
      FROM roadmaps
      WHERE id = ${roadmapId}
      LIMIT 1
    `;
    const csvText = (rows[0] as { csv_text?: string } | undefined)?.csv_text ?? '';
    return {
      items: csvText ? (await import('@/lib/loadRoadmapFromCsv')).parseRoadmapCsv(csvText) : [],
      stale: false,
      truncated: false,
    };
  }

  const config = sanitizeAzureConfig(parseConfig(record?.config_json));
  const normalizedUrl = normalizeOrganizationUrl(config.organizationUrl);
  if (!normalizedUrl || !config.project) {
    throw new Error('Azure DevOps configuration is incomplete.');
  }

  const refreshMinutes = getRefreshMinutes(config);
  if (shouldUseSnapshot(record, refreshMinutes, forceRefresh)) {
    return { items: readSnapshot(record), stale: false, truncated: false };
  }

  if (!record?.secret_encrypted) {
    throw new Error('Azure DevOps PAT is missing.');
  }

  const pat = decryptSecret(record.secret_encrypted);
  const start = Date.now();
  try {
    const { items, truncated } = await fetchAzureDevopsItems(normalizedUrl, config, pat);
    const duration = Date.now() - start;
    const now = new Date().toISOString();
    await sql`
      UPDATE roadmap_datasources
      SET last_snapshot_json = ${JSON.stringify(items)},
          last_snapshot_at = ${now},
          last_sync_at = ${now},
          last_sync_duration_ms = ${duration},
          last_sync_item_count = ${items.length},
          last_sync_error = NULL
      WHERE roadmap_id = ${roadmapId}
    `;
    return { items, stale: false, truncated };
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Unknown error';
    await sql`
      UPDATE roadmap_datasources
      SET last_sync_at = ${now},
          last_sync_error = ${message}
      WHERE roadmap_id = ${roadmapId}
    `;
    const snapshot = readSnapshot(record);
    if (snapshot.length > 0) {
      return {
        items: snapshot,
        stale: true,
        truncated: false,
        warning: `Using cached data from ${record?.last_snapshot_at ?? 'unknown time'}`,
      };
    }
    throw error;
  }
}

export async function fetchAzureDevopsDebugPayload(
  roadmapId: string,
  sampleSize: number,
): Promise<{
  config: AzureDevopsDatasourceConfig;
  wiql: string;
  fields: string[];
  sampleIds: number[];
  totalWorkItems: number;
  wiqlResponse: unknown;
  batchResponse: unknown | null;
}> {
  const record = await getDatasourceRecord(roadmapId);
  const type = resolveDatasourceType(record?.type);
  if (type !== 'azure-devops') {
    throw new Error('Datasource is not Azure DevOps.');
  }

  const config = sanitizeAzureConfig(parseConfig(record?.config_json));
  const normalizedUrl = normalizeOrganizationUrl(config.organizationUrl);
  if (!normalizedUrl || !config.project) {
    throw new Error('Azure DevOps configuration is incomplete.');
  }
  if (!record?.secret_encrypted) {
    throw new Error('Azure DevOps PAT is missing.');
  }

  const pat = decryptSecret(record.secret_encrypted);
  const headers = buildAzureDevopsRequestHeaders(pat);
  const wiql = await buildAzureDevopsWiql(normalizedUrl, config, pat);
  if (!wiql) {
    throw new Error('WIQL query is required.');
  }

  const wiqlUrl = `${normalizedUrl}/${encodeURIComponent(config.project)}/_apis/wit/wiql?api-version=7.1-preview.2`;
  const wiqlRes = await fetch(wiqlUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: wiql }),
  });
  if (!wiqlRes.ok) {
    const errorText = await wiqlRes.text().catch(() => '');
    throw new Error(
      `Azure DevOps WIQL query failed (${wiqlRes.status}). ${errorText}`.trim(),
    );
  }
  const wiqlResponse = (await wiqlRes.json()) as {
    workItems?: Array<{ id: number }>;
  };
  const ids = (wiqlResponse.workItems ?? []).map((item) => item.id);
  const sampleIds = ids.slice(0, Math.max(1, sampleSize));
  const fields = getFieldListForConfig(config);

  let batchResponse: unknown | null = null;
  if (sampleIds.length > 0) {
    const batchUrl = `${normalizedUrl}/${encodeURIComponent(config.project)}/_apis/wit/workitemsbatch?api-version=7.1-preview.1`;
    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: sampleIds, fields }),
    });
    if (!batchRes.ok) {
      const errorText = await batchRes.text().catch(() => '');
      throw new Error(
        `Azure DevOps work item batch failed (${batchRes.status}). ${errorText}`.trim(),
      );
    }
    batchResponse = await batchRes.json();
  }

  return {
    config,
    wiql,
    fields,
    sampleIds,
    totalWorkItems: ids.length,
    wiqlResponse,
    batchResponse,
  };
}

export async function fetchAzureDevopsWorkItemComments(
  roadmapId: string,
  workItemId: string,
): Promise<AzureDevopsComment[]> {
  const record = await getDatasourceRecord(roadmapId);
  const type = resolveDatasourceType(record?.type);
  if (type !== 'azure-devops') {
    throw new Error('Datasource is not Azure DevOps.');
  }

  const config = sanitizeAzureConfig(parseConfig(record?.config_json));
  const normalizedUrl = normalizeOrganizationUrl(config.organizationUrl);
  if (!normalizedUrl || !config.project) {
    throw new Error('Azure DevOps configuration is incomplete.');
  }
  if (!record?.secret_encrypted) {
    throw new Error('Azure DevOps PAT is missing.');
  }

  const pat = decryptSecret(record.secret_encrypted);
  const headers = buildAzureDevopsRequestHeaders(pat);
  const commentsUrl = `${normalizedUrl}/${encodeURIComponent(
    config.project,
  )}/_apis/wit/workItems/${encodeURIComponent(workItemId)}/comments?api-version=7.1-preview.3`;
  const res = await fetch(commentsUrl, { headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `Azure DevOps comments request failed (${res.status}). ${errorText}`.trim(),
    );
  }
  const data = (await res.json()) as { comments?: AzureDevopsComment[] };
  return Array.isArray(data.comments) ? data.comments : [];
}

export async function fetchAzureDevopsWorkItemRelatedItems(
  roadmapId: string,
  workItemId: string,
): Promise<
  Array<{
    id: number;
    title: string;
    state: string;
    createdDate: string | null;
    url: string;
  }>
> {
  const record = await getDatasourceRecord(roadmapId);
  const type = resolveDatasourceType(record?.type);
  if (type !== 'azure-devops') {
    throw new Error('Datasource is not Azure DevOps.');
  }

  const config = sanitizeAzureConfig(parseConfig(record?.config_json));
  const normalizedUrl = normalizeOrganizationUrl(config.organizationUrl);
  if (!normalizedUrl || !config.project) {
    throw new Error('Azure DevOps configuration is incomplete.');
  }
  if (!record?.secret_encrypted) {
    throw new Error('Azure DevOps PAT is missing.');
  }

  const pat = decryptSecret(record.secret_encrypted);
  const headers = buildAzureDevopsRequestHeaders(pat);
  const workItemUrl = `${normalizedUrl}/${encodeURIComponent(
    config.project,
  )}/_apis/wit/workitems/${encodeURIComponent(
    workItemId,
  )}?$expand=relations&api-version=7.1-preview.3`;
  const res = await fetch(workItemUrl, { headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `Azure DevOps work item request failed (${res.status}). ${errorText}`.trim(),
    );
  }
  const data = (await res.json()) as { relations?: AzureDevopsRelation[] };
  const relations = Array.isArray(data.relations) ? data.relations : [];
  const relatedIds = relations
    .filter((relation) => relation.rel === 'System.LinkTypes.Related')
    .map((relation) => relation.url ?? '')
    .map((url) => {
      const match = /workItems\/(\d+)/i.exec(url);
      return match ? Number.parseInt(match[1], 10) : null;
    })
    .filter((id): id is number => Boolean(id));

  if (relatedIds.length === 0) return [];

  const batchUrl = `${normalizedUrl}/${encodeURIComponent(
    config.project,
  )}/_apis/wit/workitemsbatch?api-version=7.1-preview.1`;
  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ids: relatedIds,
      fields: [
        'System.Title',
        'System.State',
        'System.CreatedDate',
        'System.ChangedDate',
        'Microsoft.VSTS.Common.ResolvedDate',
        'Microsoft.VSTS.Common.ClosedDate',
        'Microsoft.VSTS.Scheduling.TargetDate',
      ],
    }),
  });
  if (!batchRes.ok) {
    const errorText = await batchRes.text().catch(() => '');
    throw new Error(
      `Azure DevOps related batch failed (${batchRes.status}). ${errorText}`.trim(),
    );
  }
  const batchData = (await batchRes.json()) as {
    value?: AzureDevopsWorkItemDetail[];
  };
  const items = Array.isArray(batchData.value) ? batchData.value : [];

  return items.map((item) => {
    const fields = item.fields ?? {};
    const title =
      typeof fields['System.Title'] === 'string'
        ? (fields['System.Title'] as string)
        : `Work Item ${item.id}`;
    const state =
      typeof fields['System.State'] === 'string'
        ? (fields['System.State'] as string)
        : 'Unknown';
    const createdDate =
      typeof fields['System.CreatedDate'] === 'string'
        ? (fields['System.CreatedDate'] as string)
        : null;
    const changedDate =
      typeof fields['System.ChangedDate'] === 'string'
        ? (fields['System.ChangedDate'] as string)
        : null;
    const resolvedDate =
      typeof fields['Microsoft.VSTS.Common.ResolvedDate'] === 'string'
        ? (fields['Microsoft.VSTS.Common.ResolvedDate'] as string)
        : null;
    const closedDate =
      typeof fields['Microsoft.VSTS.Common.ClosedDate'] === 'string'
        ? (fields['Microsoft.VSTS.Common.ClosedDate'] as string)
        : null;
    const targetDate =
      typeof fields['Microsoft.VSTS.Scheduling.TargetDate'] === 'string'
        ? (fields['Microsoft.VSTS.Scheduling.TargetDate'] as string)
        : null;
    return {
      id: item.id,
      title,
      state,
      createdDate,
      changedDate,
      resolvedDate,
      closedDate,
      targetDate,
      url: `${normalizedUrl}/${encodeURIComponent(config.project)}/_workitems/edit/${item.id}`,
    };
  });
}

export async function validateAzureDevopsConfig(
  config: AzureDevopsDatasourceConfig,
  secret: string | null,
): Promise<{ warnings: string[]; missingFields: string[]; missingFieldKeys: string[] }> {
  const normalizedUrl = normalizeOrganizationUrl(config.organizationUrl);
  if (!normalizedUrl || !config.project) {
    throw new Error('Organization URL and project are required.');
  }

  if (!secret) {
    throw new Error('PAT is required for validation.');
  }

  const headers = buildAzureDevopsRequestHeaders(secret);
  const wiql = await buildAzureDevopsWiql(normalizedUrl, config, secret);
  if (!wiql) {
    throw new Error('WIQL query is required.');
  }

  const wiqlUrl = `${normalizedUrl}/${encodeURIComponent(config.project)}/_apis/wit/wiql?api-version=7.1-preview.2`;
  const wiqlRes = await fetch(wiqlUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: wiql }),
  });
  if (!wiqlRes.ok) {
    const errorText = await wiqlRes.text().catch(() => '');
    throw new Error(`WIQL validation failed (${wiqlRes.status}). ${errorText}`.trim());
  }
  const wiqlResponse = (await wiqlRes.json()) as {
    workItems?: Array<{ id: number }>;
  };
  const ids = (wiqlResponse.workItems ?? []).map((item) => item.id);
  const sampleIds = ids.slice(0, Math.max(1, 10));
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const missingFieldKeys: string[] = [];

  const fieldMap = getFieldMapForConfig(config);
  const mappedFields = Object.values(fieldMap).filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );

  try {
    const fieldsUrl = `${normalizedUrl}/_apis/wit/fields?api-version=7.1-preview.2`;
    const fieldsRes = await fetch(fieldsUrl, { headers });
    if (fieldsRes.ok) {
      const fieldsData = (await fieldsRes.json()) as {
        value?: Array<{ referenceName?: string }>;
      };
      const knownFields = new Set(
        (fieldsData.value ?? [])
          .map((field) => field.referenceName)
          .filter((name): name is string => Boolean(name)),
      );
      mappedFields.forEach((field) => {
        if (!knownFields.has(field)) {
          missingFields.push(field);
        }
      });
      if (missingFields.length > 0) {
        warnings.push(`Unknown fields: ${missingFields.join(', ')}`);
      }
    }
  } catch {
    // Ignore field lookup failures; fall back to sample checks.
  }
  if (sampleIds.length === 0) {
    warnings.push('No work items returned. Field mapping could not be verified.');
    return { warnings, missingFields, missingFieldKeys };
  }

  const fields = getFieldListForConfig(config).filter(
    (field) => !missingFields.includes(field),
  );
  const batchUrl = `${normalizedUrl}/${encodeURIComponent(config.project)}/_apis/wit/workitemsbatch?api-version=7.1-preview.1`;
  const batchRes = await fetch(batchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: sampleIds, fields }),
  });
  if (!batchRes.ok) {
    const errorText = await batchRes.text().catch(() => '');
    throw new Error(
      `Azure DevOps work item batch failed (${batchRes.status}). ${errorText}`.trim(),
    );
  }
  const batchResponse = (await batchRes.json()) as {
    value?: Array<{ fields?: Record<string, unknown> }>;
  };
  const sampleItems = batchResponse.value ?? [];
  const missing = mappedFields.filter((fieldName) => {
    if (missingFields.includes(fieldName)) return false;
    return !sampleItems.some(
      (item) => item.fields && Object.prototype.hasOwnProperty.call(item.fields, fieldName),
    );
  });
  if (missing.length > 0) {
    warnings.push(`Missing mapped fields: ${missing.join(', ')}`);
  }
  const fieldEntries = Object.entries(fieldMap);
  fieldEntries.forEach(([key, value]) => {
    if (!value || typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (missingFields.includes(trimmed) || missing.includes(trimmed)) {
      missingFieldKeys.push(key);
    }
  });
  return { warnings, missingFields, missingFieldKeys };
}

export async function listAzureDevopsProjects(
  organizationUrl: string,
  secret: string | null,
): Promise<string[]> {
  const normalizedUrl = normalizeOrganizationUrl(organizationUrl);
  if (!normalizedUrl) {
    throw new Error('Organization URL is required.');
  }
  if (!secret) {
    throw new Error('PAT is required to list projects.');
  }

  const headers = buildAzureDevopsRequestHeaders(secret);
  const projectsUrl = `${normalizedUrl}/_apis/projects?api-version=7.1-preview.4`;
  const res = await fetch(projectsUrl, { headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Project lookup failed (${res.status}). ${errorText}`.trim());
  }
  const data = (await res.json()) as { value?: Array<{ name?: string }> };
  return (data.value ?? [])
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));
}

type WorkItemLookup = {
  organizationUrl: string;
  project: string;
  id: string;
  workItemType: string | null;
  areaPath: string | null;
};

const parseWorkItemUrl = (value: string): { organizationUrl: string; project: string; id: string } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    let org = '';
    let project = '';
    let id = '';
    if (url.hostname.endsWith('visualstudio.com')) {
      org = url.hostname.split('.')[0] ?? '';
      const parts = url.pathname.split('/').filter(Boolean);
      project = parts[0] ?? '';
      id = parts[parts.length - 1] ?? '';
    } else if (url.hostname === 'dev.azure.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      org = parts[0] ?? '';
      project = parts[1] ?? '';
      id = parts[parts.length - 1] ?? '';
    }
    if (!org || !project || !id) return null;
    return {
      organizationUrl: `https://dev.azure.com/${org}`,
      project: decodeURIComponent(project),
      id,
    };
  } catch {
    return null;
  }
};

export async function resolveAzureDevopsWorkItem(
  workItemUrl: string,
  secret: string | null,
): Promise<WorkItemLookup> {
  const parsed = parseWorkItemUrl(workItemUrl);
  if (!parsed) {
    throw new Error('Unable to parse work item URL.');
  }
  if (!secret) {
    return { ...parsed, workItemType: null, areaPath: null };
  }

  const headers = buildAzureDevopsRequestHeaders(secret);
  const itemUrl = `${parsed.organizationUrl}/${encodeURIComponent(parsed.project)}/_apis/wit/workitems/${encodeURIComponent(
    parsed.id,
  )}?api-version=7.1-preview.3&fields=System.WorkItemType,System.AreaPath`;
  const res = await fetch(itemUrl, { headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Unable to load work item details (${res.status}). ${errorText}`.trim());
  }
  const data = (await res.json()) as { fields?: Record<string, unknown> };
  const fields = data.fields ?? {};
  const workItemType =
    typeof fields['System.WorkItemType'] === 'string'
      ? (fields['System.WorkItemType'] as string)
      : null;
  const areaPath =
    typeof fields['System.AreaPath'] === 'string'
      ? (fields['System.AreaPath'] as string)
      : null;
  return { ...parsed, workItemType, areaPath };
}
