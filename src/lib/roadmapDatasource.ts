import 'server-only';
import type { RoadmapItem } from '@/types/roadmap';
import type {
  AzureDevopsDatasourceConfig,
  RoadmapDatasourceType,
  RoadmapFieldMap,
} from '@/types/roadmapDatasources';
import {
  normalizeRegionList,
  normalizeStakeholders,
  normalizeTitleCase,
} from '@/lib/normalizeFields';

const DEFAULT_REFRESH_MINUTES = 15;
const DEFAULT_MAX_ITEMS = 500;

const DEFAULT_FIELD_MAP: RoadmapFieldMap = {
  title: 'System.Title',
  shortDescription: 'Custom.ShortDescription',
  longDescription: 'System.Description',
  startDate: 'Microsoft.VSTS.Scheduling.StartDate',
  endDate: 'Microsoft.VSTS.Scheduling.FinishDate',
  pillar: 'Custom.Pillar',
  region: 'System.Tags',
  criticality: 'Custom.Criticality',
  disposition: 'Custom.Status',
  impactedStakeholders: 'System.Tags',
  tShirtSize: 'Custom.TshirtSize',
  submitterName: 'Custom.SubmitterName',
  submitterDepartment: 'Custom.SubmitterDepartment',
  submitterPriority: 'Custom.SubmitterPriority',
  expenseType: 'Custom.ExpenseType',
  pointOfContact: 'Custom.PointOfContact',
  lead: 'Custom.Lead',
  executiveSponsor: 'Custom.ExecutiveSponsor',
};

const normalizeTShirt = (value: string | undefined): RoadmapItem['tShirtSize'] => {
  const key = (value ?? '').trim().toLowerCase();
  if (key === 'xs') return 'XS';
  if (key === 's') return 'S';
  if (key === 'm') return 'M';
  if (key === 'l') return 'L';
  return '';
};

export const normalizeOrganizationUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.hostname.endsWith('visualstudio.com')) {
      const org = url.hostname.split('.')[0];
      return `https://dev.azure.com/${org}`;
    }
    if (url.hostname === 'dev.azure.com') {
      const org = url.pathname.split('/').filter(Boolean)[0];
      if (!org) return null;
      return `https://dev.azure.com/${org}`;
    }
    return trimmed;
  } catch {
    return null;
  }
};

const buildFieldMap = (config: AzureDevopsDatasourceConfig) => ({
  ...DEFAULT_FIELD_MAP,
  ...(config.fieldMap ?? {}),
});

export const getFieldMapForConfig = (config: AzureDevopsDatasourceConfig) =>
  buildFieldMap(config);

const collectFields = (fieldMap: RoadmapFieldMap) => {
  const fields = new Set<string>();
  fields.add('System.Id');
  fields.add('System.Title');
  fields.add('System.CreatedDate');
  fields.add('Microsoft.VSTS.Scheduling.TargetDate');
  fields.add('Microsoft.VSTS.Scheduling.StartDate');
  fields.add('Microsoft.VSTS.Scheduling.FinishDate');
  Object.values(fieldMap)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .forEach((value) => fields.add(value));
  return Array.from(fields);
};

const buildWorkItemUrl = (baseUrl: string, project: string, id: number | string) =>
  `${baseUrl}/${encodeURIComponent(project)}/_workitems/edit/${id}`;

const extractFieldValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => extractFieldValue(entry))
      .filter((entry) => entry.length > 0)
      .join(', ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = ['displayName', 'name', 'uniqueName', 'mail', 'email', 'value'];
    for (const key of candidates) {
      const candidate = record[key];
      const extracted = extractFieldValue(candidate);
      if (extracted) return extracted;
    }
  }
  return '';
};

const getFieldValue = (fields: Record<string, unknown>, key?: string) => {
  if (!key) return '';
  return extractFieldValue(fields[key]);
};

const getFirstFieldValue = (fields: Record<string, unknown>, keys: Array<string | undefined>) => {
  for (const key of keys) {
    if (!key) continue;
    const value = getFieldValue(fields, key);
    if (value) return value;
  }
  return '';
};

export const mapAzureDevopsItem = (
  baseUrl: string,
  config: AzureDevopsDatasourceConfig,
  item: { id: number; fields: Record<string, unknown> },
): RoadmapItem | null => {
  const fieldMap = buildFieldMap(config);
  const fields = item.fields ?? {};
  const missingDateStrategy = config.missingDateStrategy ?? 'fallback';
  const stakeholderPrefix =
    (config.stakeholderTagPrefix ?? '').trim() || 'Stakeholder:';
  const regionPrefix = (config.regionTagPrefix ?? '').trim() || 'Region:';

  const title = getFieldValue(fields, fieldMap.title);
  const startCandidate =
    getFieldValue(fields, fieldMap.startDate) || getFieldValue(fields, 'Microsoft.VSTS.Scheduling.StartDate');
  const endCandidate =
    getFieldValue(fields, fieldMap.endDate) || getFieldValue(fields, 'Microsoft.VSTS.Scheduling.FinishDate');
  const createdDate = getFieldValue(fields, 'System.CreatedDate');
  const targetDate = getFieldValue(fields, 'Microsoft.VSTS.Scheduling.TargetDate');

  let startDate = startCandidate;
  let endDate = endCandidate;

  if (missingDateStrategy === 'fallback') {
    startDate = startDate || createdDate;
    endDate = endDate || targetDate || startDate;
  }

  if (missingDateStrategy === 'skip' && (!startDate || !endDate)) {
    return null;
  }

  if (!startDate) startDate = '';
  if (!endDate) {
    endDate = missingDateStrategy === 'fallback' ? startDate || '' : '';
  }

  const urlField = getFieldValue(fields, fieldMap.url);
  const url = urlField || buildWorkItemUrl(baseUrl, config.project, item.id);

  const rawStakeholders = getFieldValue(fields, fieldMap.impactedStakeholders);
  const normalizeTagValue = (tag: string, prefix: string) => {
    const trimmed = tag.trim();
    if (!prefix) return trimmed;
    const normalizedPrefix = prefix.trim().toLowerCase();
    const lower = trimmed.toLowerCase();
    if (!lower.startsWith(normalizedPrefix)) return '';
    return trimmed.slice(normalizedPrefix.length).trim();
  };
  const impactedStakeholders =
    fieldMap.impactedStakeholders === 'System.Tags' && rawStakeholders
      ? rawStakeholders
          .split(';')
          .map((tag) => normalizeTagValue(tag, stakeholderPrefix))
          .filter(Boolean)
          .join(', ')
      : rawStakeholders;

  const rawRegion = getFieldValue(fields, fieldMap.region);
  const region =
    fieldMap.region === 'System.Tags' && rawRegion
      ? rawRegion
          .split(';')
          .map((tag) => normalizeTagValue(tag, regionPrefix))
          .filter(Boolean)
          .join(', ')
      : rawRegion;

  return {
    id: String(item.id),
    title: title || `Work Item ${item.id}`,
    url,
    impactedStakeholders: normalizeStakeholders(impactedStakeholders),
    submitterName: getFirstFieldValue(fields, [
      fieldMap.submitterName,
      'Custom.SubmitterName',
      'Custom.Submitter_x0020_Name',
    ]),
    submitterDepartment: getFirstFieldValue(fields, [
      fieldMap.submitterDepartment,
      'Custom.SubmitterDepartment',
      'Custom.Submitter_x0020_Department',
    ]),
    submitterPriority: getFirstFieldValue(fields, [
      fieldMap.submitterPriority,
      'Custom.SubmitterPriority',
      'Custom.Submitter_x0020_Priority',
    ]),
    shortDescription: getFirstFieldValue(fields, [
      fieldMap.shortDescription,
      'Custom.ShortDescription',
      'Custom.Summary',
      'System.Description',
    ]),
    longDescription: getFirstFieldValue(fields, [
      fieldMap.longDescription,
      'System.Description',
      'Custom.LongDescription',
      'Custom.Description',
    ]),
    criticality: normalizeTitleCase(getFieldValue(fields, fieldMap.criticality)),
    disposition: normalizeTitleCase(getFieldValue(fields, fieldMap.disposition)),
    executiveSponsor: getFirstFieldValue(fields, [
      fieldMap.executiveSponsor,
      'Custom.Executive_Sponsor',
      'Custom.ExecutiveSponsor',
    ]),
    startDate,
    endDate,
    tShirtSize: normalizeTShirt(getFieldValue(fields, fieldMap.tShirtSize)),
    pillar: normalizeTitleCase(getFieldValue(fields, fieldMap.pillar)),
    region: normalizeRegionList(region),
    expenseType: getFirstFieldValue(fields, [
      fieldMap.expenseType,
      'Custom.ExpenseType',
      'Custom.Expense_x0020_Type',
    ]),
    pointOfContact: getFirstFieldValue(fields, [
      fieldMap.pointOfContact,
      'Custom.PointOfContact',
      'Custom.Point_x0020_Of_x0020_Contact',
    ]),
    lead: getFirstFieldValue(fields, [
      fieldMap.lead,
      'Custom.Lead',
    ]),
  };
};

export const getRefreshMinutes = (config: AzureDevopsDatasourceConfig) =>
  Math.min(60, Math.max(5, config.refreshMinutes ?? DEFAULT_REFRESH_MINUTES));

export const getMaxItems = (config: AzureDevopsDatasourceConfig) =>
  Math.min(2000, Math.max(1, config.maxItems ?? DEFAULT_MAX_ITEMS));

export const buildAzureDevopsRequestHeaders = (pat: string) => ({
  Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
  'Content-Type': 'application/json',
});

export const resolveDatasourceType = (
  value: string | null | undefined,
): RoadmapDatasourceType => (value === 'azure-devops' ? 'azure-devops' : 'csv');

export const getFieldListForConfig = (config: AzureDevopsDatasourceConfig) =>
  collectFields(buildFieldMap(config));
