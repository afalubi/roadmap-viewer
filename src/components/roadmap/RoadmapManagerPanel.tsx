'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import type { RoadmapRole, RoadmapSummary } from '@/types/roadmaps';
import type {
  AzureDevopsDatasourceConfig,
  RoadmapDatasourceSummary,
  RoadmapDatasourceType,
} from '@/types/roadmapDatasources';
import type { DirectoryUser } from '@/types/userDirectory';
import { UserSearchInput } from '@/components/shared/UserSearchInput';
import { buildCsvFromItems } from '@/lib/roadmapCsv';

type ShareEntry = {
  userId: string;
  userEmail?: string | null;
  role: RoadmapRole;
  createdAt: string;
  updatedAt: string;
};

interface Props {
  isLoading: boolean;
  roadmaps: RoadmapSummary[];
  activeRoadmapId?: string | null;
  currentUserId?: string | null;
  shareRoadmapId?: string | null;
  showDebug?: boolean;
  onShareRoadmapClose?: () => void;
  onLoadRoadmap: (roadmap: RoadmapSummary) => void;
  onCreateRoadmap: (name: string, csvText: string) => Promise<boolean>;
  onRenameRoadmap: (id: string, name: string) => Promise<boolean>;
  onDeleteRoadmap: (id: string) => Promise<boolean>;
  onShareUser: (id: string, userId: string, role: RoadmapRole) => Promise<boolean>;
  onUpdateShare: (id: string, userId: string, role: RoadmapRole) => Promise<boolean>;
  onRevokeShare: (id: string, userId: string) => Promise<boolean>;
  variant?: 'card' | 'plain';
}

const ROLE_ORDER: Record<RoadmapRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

const roleLabel = (role: RoadmapRole) =>
  role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer';

export function RoadmapManagerPanel({
  isLoading,
  roadmaps,
  activeRoadmapId,
  currentUserId,
  shareRoadmapId,
  showDebug = false,
  onShareRoadmapClose,
  onLoadRoadmap,
  onCreateRoadmap,
  onRenameRoadmap,
  onDeleteRoadmap,
  onShareUser,
  onUpdateShare,
  onRevokeShare,
  variant = 'card',
}: Props) {
  const isPlain = variant === 'plain';
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<RoadmapSummary | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [shareRoadmap, setShareRoadmap] = useState<RoadmapSummary | null>(null);
  const [shareEntries, setShareEntries] = useState<ShareEntry[]>([]);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareUserQuery, setShareUserQuery] = useState('');
  const [shareSelectedUser, setShareSelectedUser] = useState<DirectoryUser | null>(null);
  const [shareRole, setShareRole] = useState<RoadmapRole>('editor');
  const [datasourceRoadmap, setDatasourceRoadmap] = useState<RoadmapSummary | null>(null);
  const [datasourceType, setDatasourceType] = useState<RoadmapDatasourceType>('csv');
  const [datasourceConfig, setDatasourceConfig] = useState<AzureDevopsDatasourceConfig>({
    organizationUrl: '',
    project: '',
    team: '',
    queryMode: 'simple',
    queryTemplate: 'epics-features-active',
    areaPath: '',
    workItemTypes: [],
    includeClosed: false,
    stakeholderTagPrefix: 'Stakeholder:',
    regionTagPrefix: 'Region:',
    queryType: 'wiql',
    queryText: '',
    refreshMinutes: 15,
    maxItems: 500,
    missingDateStrategy: 'fallback',
  });
  const [datasourceHasSecret, setDatasourceHasSecret] = useState(false);
  const [datasourcePat, setDatasourcePat] = useState('');
  const [datasourceWorkItemUrl, setDatasourceWorkItemUrl] = useState('');
  const [datasourceStatus, setDatasourceStatus] = useState<string | null>(null);
  const [datasourceDebugPayload, setDatasourceDebugPayload] = useState<
    Record<string, unknown> | null
  >(null);
  const [datasourceDebugError, setDatasourceDebugError] = useState<string | null>(
    null,
  );
  const [isDatasourceDebugOpen, setIsDatasourceDebugOpen] = useState(false);
  const [isDatasourceDebugLoading, setIsDatasourceDebugLoading] = useState(false);
  const [isDatasourceLoading, setIsDatasourceLoading] = useState(false);
  const [isDatasourceSaving, setIsDatasourceSaving] = useState(false);
  const [isDatasourceValidating, setIsDatasourceValidating] = useState(false);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [datasourceOpenSection, setDatasourceOpenSection] = useState<
    'quick' | 'derived' | 'connection' | 'query' | 'refresh' | 'mapping' | null
  >(null);
  const [isDownloadingDelete, setIsDownloadingDelete] = useState(false);

  const sortedRoadmaps = useMemo(() => {
    return [...roadmaps].sort((a, b) => {
      const roleDiff = ROLE_ORDER[b.role] - ROLE_ORDER[a.role];
      if (roleDiff !== 0) return roleDiff;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [roadmaps]);

  useEffect(() => {
    if (!shareRoadmap) return;
    const latest = roadmaps.find((roadmap) => roadmap.id === shareRoadmap.id);
    if (latest) {
      setShareRoadmap(latest);
    }
  }, [roadmaps, shareRoadmap?.id]);

  const canEdit = (role: RoadmapRole) => ROLE_ORDER[role] >= ROLE_ORDER.editor;
  const canDelete = (role: RoadmapRole) => role === 'owner';
  const canShare = (role: RoadmapRole) => ROLE_ORDER[role] >= ROLE_ORDER.editor;
  const canConfigureDatasource = (role: RoadmapRole) => role === 'owner';

  const handleDatasourceSectionClick =
    (section: NonNullable<typeof datasourceOpenSection>) =>
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      setDatasourceOpenSection((prev) => (prev === section ? null : section));
    };

  const summaryClasses =
    'flex w-full items-center justify-between text-left text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  const hasText = (value: string | undefined | null) => Boolean(value && value.trim().length > 0);
  const isQuickComplete =
    hasText(datasourceWorkItemUrl) && (hasText(datasourcePat) || datasourceHasSecret);
  const isDerivedComplete =
    (datasourceConfig.areaPath ?? '').trim().length > 0 ||
    (datasourceConfig.workItemTypes ?? []).length > 0;
  const isConnectionComplete =
    hasText(datasourceConfig.organizationUrl) && hasText(datasourceConfig.project);
  const isQueryComplete =
    datasourceConfig.queryMode === 'advanced'
      ? hasText(datasourceConfig.queryText)
      : true;
  const isRefreshComplete = true;
  const isMappingComplete = Boolean(
    datasourceConfig.fieldMap &&
      Object.values(datasourceConfig.fieldMap).some((value) => hasText(value)),
  );

  const handleShare = (roadmap: RoadmapSummary) => {
    setShareRoadmap(roadmap);
    setShareEntries([]);
    setShareUserQuery('');
    setShareSelectedUser(null);
    setShareRole('editor');
  };

  useEffect(() => {
    if (!shareRoadmapId) return;
    const match = roadmaps.find((roadmap) => roadmap.id === shareRoadmapId);
    if (match) {
      handleShare(match);
    }
  }, [roadmaps, shareRoadmapId]);

  const fetchShares = async (roadmapId: string) => {
    setIsShareLoading(true);
    try {
      const res = await fetch(`/api/roadmaps/${roadmapId}/share`);
      if (!res.ok) {
        setShareEntries([]);
        return;
      }
      const data = await res.json();
      setShareEntries((data.shares ?? []) as ShareEntry[]);
    } catch {
      setShareEntries([]);
    } finally {
      setIsShareLoading(false);
    }
  };

  useEffect(() => {
    if (!shareRoadmap) return;
    fetchShares(shareRoadmap.id);
  }, [shareRoadmap?.id]);

  const downloadRoadmapCsv = async (roadmapId: string, roadmapName: string) => {
    setIsDownloadingDelete(true);
    try {
      const res = await fetch(`/api/roadmaps/${roadmapId}/datasource/items?format=csv`);
      if (!res.ok) return;
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = roadmapName
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]+/g, '-');
      const dateSuffix = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${safeName || 'roadmap'}-${dateSuffix}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingDelete(false);
    }
  };

  const downloadRoadmapExcel = async (roadmapId: string, roadmapName: string) => {
    setIsDownloadingDelete(true);
    try {
      const res = await fetch(`/api/roadmaps/${roadmapId}/datasource/items`);
      if (!res.ok) return;
      const data = (await res.json()) as { items?: unknown[] };
      const items = Array.isArray(data.items) ? data.items : [];
      const csvText = buildCsvFromItems(items as any[]);
      const XLSX = await import('xlsx');
      const csvWorkbook = XLSX.read(csvText, { type: 'string' });
      const sheetName = csvWorkbook.SheetNames[0];
      const worksheet = sheetName ? csvWorkbook.Sheets[sheetName] : XLSX.utils.aoa_to_sheet([]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Roadmap');
      const excelBuffer = XLSX.write(workbook, {
        bookType: 'xlsx',
        type: 'array',
      });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = roadmapName
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]+/g, '-');
      const dateSuffix = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${safeName || 'roadmap'}-${dateSuffix}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingDelete(false);
    }
  };

  const openDatasourceModal = async (roadmap: RoadmapSummary) => {
    setDatasourceRoadmap(roadmap);
    setDatasourceStatus(null);
    setDatasourceDebugPayload(null);
    setDatasourceDebugError(null);
    setIsDatasourceDebugOpen(false);
    setDatasourcePat('');
    setDatasourceWorkItemUrl('');
    setProjectOptions([]);
    setDatasourceOpenSection(null);
    setIsDatasourceLoading(true);
    try {
      const res = await fetch(`/api/roadmaps/${roadmap.id}/datasource`);
      if (!res.ok) {
        setDatasourceType('csv');
        return;
      }
      const data = (await res.json()) as { datasource?: RoadmapDatasourceSummary };
      const summary = data.datasource;
      if (summary) {
        setDatasourceType(summary.type);
        setDatasourceHasSecret(summary.hasSecret);
        setDatasourceConfig({
          organizationUrl: summary.config?.organizationUrl ?? '',
          project: summary.config?.project ?? '',
          team: summary.config?.team ?? '',
          queryMode: summary.config?.queryMode ?? 'simple',
          queryTemplate: summary.config?.queryTemplate ?? 'epics-features-active',
          areaPath: summary.config?.areaPath ?? '',
          workItemTypes: summary.config?.workItemTypes ?? [],
          includeClosed: summary.config?.includeClosed ?? false,
          stakeholderTagPrefix: summary.config?.stakeholderTagPrefix ?? 'Stakeholder:',
          regionTagPrefix: summary.config?.regionTagPrefix ?? 'Region:',
          queryType: summary.config?.queryType ?? 'wiql',
          queryText: summary.config?.queryText ?? '',
          refreshMinutes: summary.config?.refreshMinutes ?? 15,
          maxItems: summary.config?.maxItems ?? 500,
          missingDateStrategy: summary.config?.missingDateStrategy ?? 'fallback',
          fieldMap: summary.config?.fieldMap ?? undefined,
        });
      }
    } catch {
      setDatasourceType('csv');
    } finally {
      setIsDatasourceLoading(false);
    }
  };

  const handleValidateDatasource = async () => {
    if (!datasourceRoadmap) return;
    setIsDatasourceValidating(true);
    setDatasourceStatus(null);
    try {
      const res = await fetch(
        `/api/roadmaps/${datasourceRoadmap.id}/datasource/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: datasourceType,
            config: datasourceConfig,
            pat: datasourcePat || undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setDatasourceStatus(data.error ?? 'Validation failed.');
        return;
      }
      setDatasourceStatus('Validation succeeded.');
    } catch {
      setDatasourceStatus('Validation failed.');
    } finally {
      setIsDatasourceValidating(false);
    }
  };

  const handleSaveDatasource = async () => {
    if (!datasourceRoadmap) return;
    setIsDatasourceSaving(true);
    setDatasourceStatus(null);
    try {
      const res = await fetch(`/api/roadmaps/${datasourceRoadmap.id}/datasource`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: datasourceType,
          config: datasourceConfig,
          pat: datasourcePat || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDatasourceStatus(data.error ?? 'Save failed.');
        return;
      }
      setDatasourceHasSecret(Boolean(data.datasource?.hasSecret));
      setDatasourceStatus('Saved datasource settings.');
      setDatasourcePat('');
      setDatasourceRoadmap(null);
    } catch {
      setDatasourceStatus('Save failed.');
    } finally {
      setIsDatasourceSaving(false);
    }
  };

  const handleClearDatasourcePat = async () => {
    if (!datasourceRoadmap) return;
    setIsDatasourceSaving(true);
    setDatasourceStatus(null);
    try {
      const res = await fetch(`/api/roadmaps/${datasourceRoadmap.id}/datasource`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: datasourceType,
          config: datasourceConfig,
          clearPat: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDatasourceStatus(data.error ?? 'Clear failed.');
        return;
      }
      setDatasourceHasSecret(Boolean(data.datasource?.hasSecret));
      setDatasourceStatus('Cleared PAT.');
    } catch {
      setDatasourceStatus('Clear failed.');
    } finally {
      setIsDatasourceSaving(false);
    }
  };

  const handleLoadProjects = async () => {
    if (!datasourceRoadmap) return;
    setDatasourceStatus(null);
    try {
      const res = await fetch(
        `/api/roadmaps/${datasourceRoadmap.id}/datasource/projects`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationUrl: datasourceConfig.organizationUrl,
            pat: datasourcePat || undefined,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setDatasourceStatus(data.error ?? 'Unable to load projects.');
        return;
      }
      setProjectOptions(Array.isArray(data.projects) ? data.projects : []);
      setDatasourceStatus('Loaded projects.');
    } catch {
      setDatasourceStatus('Unable to load projects.');
    }
  };

  const handleApplyWorkItemUrl = async () => {
    if (!datasourceRoadmap) return;
    setDatasourceStatus(null);
    try {
      const res = await fetch(
        `/api/roadmaps/${datasourceRoadmap.id}/datasource/work-item`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: datasourceWorkItemUrl, pat: datasourcePat || undefined }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setDatasourceStatus(data.error ?? 'Unable to parse work item URL.');
        return;
      }
      const result = data.result as {
        organizationUrl: string;
        project: string;
        id: string;
        workItemType: string | null;
        areaPath: string | null;
      };
      setDatasourceStatus('Applied work item URL.');
      setDatasourceType('azure-devops');
      setDatasourceConfig((prev) => ({
        ...prev,
        organizationUrl: result.organizationUrl,
        project: result.project,
        areaPath: result.areaPath ?? prev.areaPath ?? '',
        queryMode: result.workItemType ? 'simple' : 'advanced',
        queryTemplate: prev.queryTemplate ?? 'epics-features-active',
        workItemTypes: result.workItemType ? [result.workItemType] : prev.workItemTypes ?? [],
        queryType: 'wiql',
        queryText: result.workItemType
          ? ''
          : `SELECT [System.Id] FROM WorkItems WHERE [System.Id] = ${result.id}`,
      }));
    } catch {
      setDatasourceStatus('Unable to parse work item URL.');
    }
  };

  const handleToggleDebugPayload = async () => {
    if (!datasourceRoadmap) return;
    const nextOpen = !isDatasourceDebugOpen;
    setIsDatasourceDebugOpen(nextOpen);
    if (!nextOpen) return;
    if (datasourceDebugPayload || isDatasourceDebugLoading) return;
    setIsDatasourceDebugLoading(true);
    setDatasourceDebugError(null);
    try {
      const res = await fetch(
        `/api/roadmaps/${datasourceRoadmap.id}/datasource/debug?sample=50`,
      );
      const data = (await res.json()) as {
        payload?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok) {
        setDatasourceDebugError(data.error ?? 'Unable to load debug payload.');
        setDatasourceDebugPayload(null);
      } else {
        setDatasourceDebugPayload(data.payload ?? null);
      }
    } catch {
      setDatasourceDebugError('Unable to load debug payload.');
      setDatasourceDebugPayload(null);
    } finally {
      setIsDatasourceDebugLoading(false);
    }
  };

  const buildSimpleWiqlPreview = (config: AzureDevopsDatasourceConfig) => {
    const workItemTypes = config.workItemTypes ?? [];
    const types =
      workItemTypes.length > 0
        ? workItemTypes
        : config.queryTemplate === 'stories-active'
          ? ['User Story', 'Product Backlog Item']
          : config.queryTemplate === 'recently-changed'
            ? ['Epic', 'Feature', 'User Story', 'Product Backlog Item']
            : ['Epic', 'Feature'];
    const whereParts = [
      `[System.WorkItemType] IN (${types
        .map((type) => `'${type.replace(/'/g, "''")}'`)
        .join(', ')})`,
    ];
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
    return `SELECT [System.Id] FROM WorkItems WHERE ${whereParts.join(
      ' AND ',
    )} ORDER BY [System.ChangedDate] DESC`;
  };

  const getQueryPreview = (config: AzureDevopsDatasourceConfig) => {
    if (config.queryMode === 'advanced') {
      return config.queryText || '';
    }
    return buildSimpleWiqlPreview(config);
  };

  const MAX_NAME = 40;

  const handleRename = (roadmap: RoadmapSummary) => {
    setEditingId(roadmap.id);
    setEditingName(roadmap.name.slice(0, MAX_NAME));
  };

  const commitRename = async (roadmap: RoadmapSummary) => {
    const trimmed = editingName.trim().slice(0, MAX_NAME);
    if (!trimmed) {
      setEditingId(null);
      setEditingName('');
      return;
    }
    if (trimmed !== roadmap.name) {
      await onRenameRoadmap(roadmap.id, trimmed);
    }
    setEditingId(null);
    setEditingName('');
  };

  const renderRoadmapRow = (roadmap: RoadmapSummary) => {
    const isActive = Boolean(activeRoadmapId && roadmap.id === activeRoadmapId);
    const rowClassName = isPlain
      ? 'group flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/70 bg-transparent px-3 py-1.5 text-xs transition-colors hover:bg-slate-100/60 dark:border-slate-700/60 dark:hover:bg-slate-800/40'
      : 'group flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800';

    return (
      <div key={roadmap.id} className={rowClassName}>
        <div className="flex items-center gap-2">
          {editingId === roadmap.id ? (
            <input
              type="text"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              maxLength={MAX_NAME}
              onBlur={() => commitRename(roadmap)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitRename(roadmap);
                }
                if (event.key === 'Escape') {
                  setEditingId(null);
                  setEditingName('');
                }
              }}
              className="w-40 rounded-md border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className={[
                'inline-flex items-center gap-1 font-medium hover:underline',
                isActive
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100',
              ].join(' ')}
              onClick={() => onLoadRoadmap(roadmap)}
              title="Load roadmap"
            >
              {roadmap.name}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {roleLabel(roadmap.role)}
          </span>
          {isActive ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
              Active
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {canEdit(roadmap.role) ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 p-1 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => handleRename(roadmap)}
                aria-label={`Rename ${roadmap.name}`}
                title="Rename"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
                </svg>
              </button>
            ) : null}
            {canDelete(roadmap.role) ? (
              <button
                type="button"
                className="rounded-full border border-rose-200 p-1 text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-700/60 dark:text-rose-300 dark:hover:border-rose-600 dark:hover:bg-rose-900/40"
                onClick={() => setPendingDelete(roadmap)}
                aria-label={`Delete ${roadmap.name}`}
                title="Delete"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M6 6l1 14h10l1-14" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            ) : null}
            {canConfigureDatasource(roadmap.role) ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[0.65rem] text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => openDatasourceModal(roadmap)}
              >
                Data source
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const shareRoleOptions = shareRoadmap
    ? (['editor', 'owner'] as RoadmapRole[]).filter(
        (role) => ROLE_ORDER[role] <= ROLE_ORDER[shareRoadmap.role],
      )
    : (['editor', 'owner'] as RoadmapRole[]);

  const canManageShare = shareRoadmap ? canShare(shareRoadmap.role) : false;
  const canModifyEntry = (role: RoadmapRole, entryUserId: string) => {
    if (!shareRoadmap) return false;
    if (entryUserId === currentUserId) return false;
    if (shareRoadmap.role === 'owner') return true;
    return role === 'viewer';
  };
  const visibleShareEntries = shareEntries.filter(
    (entry) => entry.userId !== currentUserId,
  );

  return (
    <section
      className={
        isPlain
          ? 'space-y-2'
          : 'bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2 dark:bg-slate-900 dark:border-slate-700'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Roadmaps</h2>
          <p className="text-[0.7rem] text-slate-500 dark:text-slate-400">
            Select a roadmap or create a new one.
          </p>
        </div>
      </div>

      <SignedOut>
        <div
          className={
            isPlain
              ? 'flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300'
              : 'flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }
        >
          <span>Sign in to manage roadmaps.</span>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-1.5">
          {pendingDelete && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Delete roadmap?
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      This will delete “{pendingDelete.name}” and cannot be
                      undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <details className="relative" data-dropdown>
                        <summary className="list-none rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                          Export
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <button
                            type="button"
                            onClick={() =>
                              downloadRoadmapCsv(pendingDelete.id, pendingDelete.name)
                            }
                            disabled={isDownloadingDelete}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {isDownloadingDelete ? 'Preparing...' : 'Export CSV'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadRoadmapExcel(pendingDelete.id, pendingDelete.name)
                            }
                            disabled={isDownloadingDelete}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {isDownloadingDelete ? 'Preparing...' : 'Export Excel'}
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Export image is available from the roadmap view."
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-400 cursor-not-allowed dark:text-slate-500"
                          >
                            Export image
                          </button>
                        </div>
                      </details>
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setPendingDelete(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:border-rose-600 dark:hover:bg-rose-900/40"
                        onClick={async () => {
                          await onDeleteRoadmap(pendingDelete.id);
                          setPendingDelete(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          {datasourceRoadmap && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[135] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Datasource for “{datasourceRoadmap.name}”
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Owners can configure external data sources.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setDatasourceRoadmap(null)}
                      >
                        Close
                      </button>
                    </div>

                    {isDatasourceLoading ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">Loading...</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Datasource type
                          </label>
                          <select
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            value={datasourceType}
                            onChange={(event) =>
                              setDatasourceType(event.target.value as RoadmapDatasourceType)
                            }
                          >
                            <option value="csv">CSV</option>
                            <option value="azure-devops">Azure DevOps</option>
                          </select>
                        </div>

                        {datasourceType === 'azure-devops' ? (
                          <div className="space-y-4">
                            <div className="rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                              <button
                                type="button"
                                className={summaryClasses}
                                onClick={handleDatasourceSectionClick('quick')}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>Quick setup from work item URL</span>
                                  {isQuickComplete ? <CheckBadge /> : null}
                                </span>
                                <ChevronIcon isOpen={datasourceOpenSection === 'quick'} />
                              </button>
                              <AnimatedSection isOpen={datasourceOpenSection === 'quick'}>
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Paste a DevOps work item URL"
                                      value={datasourceWorkItemUrl}
                                      onChange={(event) => setDatasourceWorkItemUrl(event.target.value)}
                                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="password"
                                      placeholder={datasourceHasSecret ? 'PAT stored' : 'PAT'}
                                      value={datasourcePat}
                                      onChange={(event) => setDatasourcePat(event.target.value)}
                                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                    {datasourceHasSecret ? (
                                      <button
                                        type="button"
                                        className="rounded-full border border-rose-200 px-2 py-1 text-[0.65rem] text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-700/60 dark:text-rose-200 dark:hover:bg-rose-900/40"
                                        onClick={handleClearDatasourcePat}
                                      >
                                        Clear PAT
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="rounded-full border border-slate-300 px-3 py-1 text-[0.7rem] text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                      onClick={handleApplyWorkItemUrl}
                                      disabled={!datasourceWorkItemUrl.trim() || !datasourcePat.trim()}
                                    >
                                      Apply URL
                                    </button>
                                  </div>
                                  <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                                    Paste a URL and PAT to auto-fill org/project and detect the work
                                    item type.
                                  </div>
                                </div>
                              </AnimatedSection>
                            </div>

                            <div className="rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                              <button
                                type="button"
                                className={summaryClasses}
                                onClick={handleDatasourceSectionClick('derived')}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>Derived details</span>
                                  {isDerivedComplete ? <CheckBadge /> : null}
                                </span>
                                <ChevronIcon isOpen={datasourceOpenSection === 'derived'} />
                              </button>
                              <AnimatedSection isOpen={datasourceOpenSection === 'derived'}>
                                <div className="space-y-2">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span>Area path</span>
                                      <input
                                        readOnly
                                        value={datasourceConfig.areaPath ?? ''}
                                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span>Work item types</span>
                                      <input
                                        readOnly
                                        value={(datasourceConfig.workItemTypes ?? []).join(', ')}
                                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                      />
                                    </label>
                                  </div>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Generated query</span>
                                    <textarea
                                      readOnly
                                      value={getQueryPreview(datasourceConfig)}
                                      className="min-h-[80px] w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[0.7rem] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                    />
                                  </label>
                                </div>
                              </AnimatedSection>
                            </div>

                            <div className="rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                              <button
                                type="button"
                                className={summaryClasses}
                                onClick={handleDatasourceSectionClick('connection')}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>Connection settings</span>
                                  {isConnectionComplete ? <CheckBadge /> : null}
                                </span>
                                <ChevronIcon isOpen={datasourceOpenSection === 'connection'} />
                              </button>
                              <AnimatedSection isOpen={datasourceOpenSection === 'connection'}>
                                <div className="space-y-2">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span>Organization URL</span>
                                      <input
                                        type="text"
                                        placeholder="https://dev.azure.com/org"
                                        value={datasourceConfig.organizationUrl}
                                        onChange={(event) =>
                                          setDatasourceConfig((prev) => ({
                                            ...prev,
                                            organizationUrl: event.target.value,
                                          }))
                                        }
                                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span>Project</span>
                                      <input
                                        type="text"
                                        placeholder="Project name"
                                        value={datasourceConfig.project}
                                        onChange={(event) =>
                                          setDatasourceConfig((prev) => ({
                                            ...prev,
                                            project: event.target.value,
                                          }))
                                        }
                                        list="ado-projects"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span>Team (optional)</span>
                                      <input
                                        type="text"
                                        placeholder="Team"
                                        value={datasourceConfig.team ?? ''}
                                        onChange={(event) =>
                                          setDatasourceConfig((prev) => ({
                                            ...prev,
                                            team: event.target.value,
                                          }))
                                        }
                                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                      />
                                    </label>
                                    <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span>Personal access token</span>
                                      <input
                                        type="password"
                                        placeholder={datasourceHasSecret ? 'PAT stored' : 'PAT'}
                                        value={datasourcePat}
                                        onChange={(event) => setDatasourcePat(event.target.value)}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                      />
                                    </label>
                                    <div className="flex items-end">
                                      <button
                                        type="button"
                                        className="rounded-md border border-slate-300 px-2 py-1 text-[0.7rem] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                        onClick={handleLoadProjects}
                                      >
                                        Load projects
                                      </button>
                                    </div>
                                  </div>
                                  {projectOptions.length > 0 ? (
                                    <datalist id="ado-projects">
                                      {projectOptions.map((project) => (
                                        <option key={project} value={project} />
                                      ))}
                                    </datalist>
                                  ) : null}
                                </div>
                              </AnimatedSection>
                            </div>

                            <div className="rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                              <button
                                type="button"
                                className={summaryClasses}
                                onClick={handleDatasourceSectionClick('query')}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>Query settings</span>
                                  {isQueryComplete ? <CheckBadge /> : null}
                                </span>
                                <ChevronIcon isOpen={datasourceOpenSection === 'query'} />
                              </button>
                              <AnimatedSection isOpen={datasourceOpenSection === 'query'}>
                                <div className="space-y-2">
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Mode</span>
                                    <select
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                      value={datasourceConfig.queryMode ?? 'simple'}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          queryMode:
                                            event.target.value === 'advanced'
                                              ? 'advanced'
                                              : 'simple',
                                        }))
                                      }
                                    >
                                      <option value="simple">Simple query</option>
                                      <option value="advanced">Advanced (WIQL)</option>
                                    </select>
                                  </label>

                                  {datasourceConfig.queryMode !== 'advanced' ? (
                                    <div className="space-y-2">
                                      <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                        <span>Template</span>
                                        <select
                                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                          value={
                                            datasourceConfig.queryTemplate ??
                                            'epics-features-active'
                                          }
                                          onChange={(event) =>
                                            setDatasourceConfig((prev) => ({
                                              ...prev,
                                              queryTemplate:
                                                event.target
                                                  .value as AzureDevopsDatasourceConfig['queryTemplate'],
                                            }))
                                          }
                                        >
                                          <option value="epics-features-active">
                                            Active Epics + Features
                                          </option>
                                          <option value="stories-active">
                                            Active Stories
                                          </option>
                                          <option value="recently-changed">
                                            Recently changed (90 days)
                                          </option>
                                        </select>
                                      </label>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                          <span>Area path (optional)</span>
                                          <input
                                            type="text"
                                            placeholder="Area path"
                                            value={datasourceConfig.areaPath ?? ''}
                                            onChange={(event) =>
                                              setDatasourceConfig((prev) => ({
                                                ...prev,
                                                areaPath: event.target.value,
                                              }))
                                            }
                                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                          />
                                        </label>
                                        <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                          <span>Work item types (comma)</span>
                                          <input
                                            type="text"
                                            placeholder="Epic, Feature"
                                            value={(datasourceConfig.workItemTypes ?? []).join(', ')}
                                            onChange={(event) =>
                                              setDatasourceConfig((prev) => ({
                                                ...prev,
                                                workItemTypes: event.target.value
                                                  .split(',')
                                                  .map((item) => item.trim())
                                                  .filter(Boolean),
                                              }))
                                            }
                                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                          />
                                        </label>
                                      </div>
                                      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(datasourceConfig.includeClosed)}
                                          onChange={(event) =>
                                            setDatasourceConfig((prev) => ({
                                              ...prev,
                                              includeClosed: event.target.checked,
                                            }))
                                          }
                                        />
                                        Include closed work items
                                      </label>
                                      <button
                                        type="button"
                                        className="rounded-full border border-slate-300 px-3 py-1 text-[0.7rem] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                        onClick={() =>
                                          setDatasourceConfig((prev) => ({
                                            ...prev,
                                            queryMode: 'advanced',
                                            queryType: 'wiql',
                                            queryText: buildSimpleWiqlPreview(prev),
                                          }))
                                        }
                                      >
                                        Edit in advanced mode
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                        <span>Advanced query type</span>
                                        <select
                                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                          value={datasourceConfig.queryType}
                                          onChange={(event) =>
                                            setDatasourceConfig((prev) => ({
                                              ...prev,
                                              queryType:
                                                event.target.value === 'saved'
                                                  ? 'saved'
                                                  : 'wiql',
                                            }))
                                          }
                                        >
                                          <option value="wiql">WIQL Query</option>
                                          <option value="saved">Saved Query ID</option>
                                        </select>
                                      </label>
                                      <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                        <span>
                                          {datasourceConfig.queryType === 'saved'
                                            ? 'Saved query ID'
                                            : 'WIQL query'}
                                        </span>
                                        <textarea
                                          placeholder={
                                            datasourceConfig.queryType === 'saved'
                                              ? 'Saved query ID'
                                              : 'WIQL query'
                                          }
                                          value={datasourceConfig.queryText}
                                          onChange={(event) =>
                                            setDatasourceConfig((prev) => ({
                                              ...prev,
                                              queryText: event.target.value,
                                            }))
                                          }
                                          className="min-h-[90px] w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </AnimatedSection>
                            </div>

                            <div className="rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                              <button
                                type="button"
                                className={summaryClasses}
                                onClick={handleDatasourceSectionClick('refresh')}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>Refresh & limits</span>
                                  {isRefreshComplete ? <CheckBadge /> : null}
                                </span>
                                <ChevronIcon isOpen={datasourceOpenSection === 'refresh'} />
                              </button>
                              <AnimatedSection isOpen={datasourceOpenSection === 'refresh'}>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Refresh minutes</span>
                                    <input
                                      type="number"
                                      min={5}
                                      max={60}
                                      value={datasourceConfig.refreshMinutes ?? 15}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          refreshMinutes: Number(event.target.value) || 15,
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Max items</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={2000}
                                      value={datasourceConfig.maxItems ?? 500}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          maxItems: Number(event.target.value) || 500,
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Date handling</span>
                                    <select
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                      value={datasourceConfig.missingDateStrategy ?? 'fallback'}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          missingDateStrategy:
                                            event.target.value === 'skip'
                                              ? 'skip'
                                              : event.target.value === 'unplanned'
                                                ? 'unplanned'
                                                : 'fallback',
                                        }))
                                      }
                                    >
                                      <option value="fallback">Fallback dates</option>
                                      <option value="skip">Skip if missing</option>
                                      <option value="unplanned">Send to unplanned</option>
                                    </select>
                                  </label>
                                </div>
                              </AnimatedSection>
                            </div>

                            <div className="rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
                              <button
                                type="button"
                                className={summaryClasses}
                                onClick={handleDatasourceSectionClick('mapping')}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span>Field mapping</span>
                                  {isMappingComplete ? <CheckBadge /> : null}
                                </span>
                                <ChevronIcon isOpen={datasourceOpenSection === 'mapping'} />
                              </button>
                              <AnimatedSection isOpen={datasourceOpenSection === 'mapping'}>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Title field</span>
                                    <input
                                      type="text"
                                      placeholder="System.Title"
                                      value={datasourceConfig.fieldMap?.title ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            title: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Short description field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.ShortDescription"
                                      value={datasourceConfig.fieldMap?.shortDescription ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            shortDescription: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Long description field</span>
                                    <input
                                      type="text"
                                      placeholder="System.Description"
                                      value={datasourceConfig.fieldMap?.longDescription ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            longDescription: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Start date field</span>
                                    <input
                                      type="text"
                                      placeholder="Microsoft.VSTS.Scheduling.StartDate"
                                      value={datasourceConfig.fieldMap?.startDate ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            startDate: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>End date field</span>
                                    <input
                                      type="text"
                                      placeholder="Microsoft.VSTS.Scheduling.FinishDate"
                                      value={datasourceConfig.fieldMap?.endDate ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            endDate: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Submitter field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.SubmitterName"
                                      value={datasourceConfig.fieldMap?.submitterName ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            submitterName: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Submitter department field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.SubmitterDepartment"
                                      value={datasourceConfig.fieldMap?.submitterDepartment ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            submitterDepartment: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Submitter priority field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.SubmitterPriority"
                                      value={datasourceConfig.fieldMap?.submitterPriority ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            submitterPriority: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Expense type field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.ExpenseType"
                                      value={datasourceConfig.fieldMap?.expenseType ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            expenseType: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Point of contact field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.PointOfContact"
                                      value={datasourceConfig.fieldMap?.pointOfContact ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            pointOfContact: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Lead field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.Lead"
                                      value={datasourceConfig.fieldMap?.lead ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            lead: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Pillar field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.Pillar"
                                      value={datasourceConfig.fieldMap?.pillar ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            pillar: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Region field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.Region"
                                      value={datasourceConfig.fieldMap?.region ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            region: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Criticality field</span>
                                    <input
                                      type="text"
                                      placeholder="Custom.Criticality"
                                      value={datasourceConfig.fieldMap?.criticality ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            criticality: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Disposition field</span>
                                    <input
                                      type="text"
                                      placeholder="System.State"
                                      value={datasourceConfig.fieldMap?.disposition ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            disposition: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Impacted stakeholders field</span>
                                    <input
                                      type="text"
                                      placeholder="System.Tags"
                                      value={datasourceConfig.fieldMap?.impactedStakeholders ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          fieldMap: {
                                            ...(prev.fieldMap ?? {}),
                                            impactedStakeholders: event.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Stakeholder tag prefix</span>
                                    <input
                                      type="text"
                                      placeholder="Stakeholder:"
                                      value={datasourceConfig.stakeholderTagPrefix ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          stakeholderTagPrefix: event.target.value,
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                  <label className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>Region tag prefix</span>
                                    <input
                                      type="text"
                                      placeholder="Region:"
                                      value={datasourceConfig.regionTagPrefix ?? ''}
                                      onChange={(event) =>
                                        setDatasourceConfig((prev) => ({
                                          ...prev,
                                          regionTagPrefix: event.target.value,
                                        }))
                                      }
                                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                  </label>
                                </div>
                              </AnimatedSection>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            CSV is the default data source.
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {datasourceStatus ?? ' '}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                              onClick={handleValidateDatasource}
                              disabled={isDatasourceValidating}
                            >
                              {isDatasourceValidating ? 'Validating...' : 'Validate'}
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              onClick={handleSaveDatasource}
                              disabled={isDatasourceSaving}
                            >
                              {isDatasourceSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                        {showDebug && datasourceType === 'azure-devops' ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                              onClick={handleToggleDebugPayload}
                            >
                              {isDatasourceDebugOpen ? 'Hide' : 'View'} DevOps payload
                            </button>
                            {isDatasourceDebugOpen ? (
                              <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                {isDatasourceDebugLoading ? (
                                  <div>Loading payload...</div>
                                ) : datasourceDebugError ? (
                                  <div className="text-rose-600 dark:text-rose-300">
                                    {datasourceDebugError}
                                  </div>
                                ) : (
                                  <pre className="whitespace-pre-wrap break-words">
                                    {JSON.stringify(datasourceDebugPayload, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null}
          {shareRoadmap && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Share “{shareRoadmap.name}”
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Role limit: {roleLabel(shareRoadmap.role)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => {
                          setShareRoadmap(null);
                          onShareRoadmapClose?.();
                        }}
                      >
                        Close
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Share with user
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <UserSearchInput
                          value={shareUserQuery}
                          placeholder="Search users by name or email"
                          disabled={!canManageShare}
                          onChange={(nextValue) => {
                            setShareUserQuery(nextValue);
                            setShareSelectedUser(null);
                          }}
                          onSelect={(user) => {
                            const label = user.email
                              ? `${user.displayName} (${user.email})`
                              : user.displayName;
                            setShareUserQuery(label);
                            setShareSelectedUser(user);
                          }}
                        />
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                          value={shareRole}
                          onChange={(event) =>
                            setShareRole(event.target.value as RoadmapRole)
                          }
                          disabled={!canManageShare}
                        >
                          {shareRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={async () => {
                            const trimmed = shareUserQuery.trim();
                            const target = shareSelectedUser?.id ?? trimmed;
                            if (!target) return;
                            const ok = await onShareUser(shareRoadmap.id, target, shareRole);
                            if (ok) {
                              setShareUserQuery('');
                              setShareSelectedUser(null);
                              await fetchShares(shareRoadmap.id);
                            }
                          }}
                          disabled={!canManageShare || !(shareSelectedUser?.id ?? shareUserQuery.trim())}
                        >
                          Grant access
                        </button>
                      </div>
                    </div>

                    {!isShareLoading && visibleShareEntries.length === 0 ? null : (
                      <div className="space-y-2">
                        <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Current access
                        </div>
                        {isShareLoading ? (
                          <div className="text-xs text-slate-400 dark:text-slate-500">Loading...</div>
                        ) : (
                          <div className="space-y-2">
                            {visibleShareEntries.map((entry) => (
                                <div
                                  key={entry.userId}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700"
                                >
                                  <div className="text-slate-700 dark:text-slate-200">
                                    {entry.userEmail ?? entry.userId}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {canManageShare &&
                                    canModifyEntry(entry.role, entry.userId) &&
                                    entry.role !== 'viewer' ? (
                                      <select
                                        className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                        value={entry.role}
                                        onChange={async (event) => {
                                          const nextRole = event.target.value as RoadmapRole;
                                          if (nextRole === entry.role) return;
                                          const ok = await onUpdateShare(
                                            shareRoadmap.id,
                                            entry.userId,
                                            nextRole,
                                          );
                                          if (ok) {
                                            await fetchShares(shareRoadmap.id);
                                          }
                                        }}
                                      >
                                        {shareRoleOptions.map((role) => (
                                          <option key={role} value={role}>
                                            {roleLabel(role)}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                        {roleLabel(entry.role)}
                                      </span>
                                    )}
                                    {canManageShare &&
                                    canModifyEntry(entry.role, entry.userId) &&
                                    entry.role === 'viewer' ? (
                                      <button
                                        type="button"
                                        className="rounded-full border border-slate-300 px-2 py-0.5 text-[0.7rem] text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                        onClick={async () => {
                                          const ok = await onUpdateShare(
                                            shareRoadmap.id,
                                            entry.userId,
                                            'editor',
                                          );
                                          if (ok) {
                                            await fetchShares(shareRoadmap.id);
                                          }
                                        }}
                                      >
                                        Upgrade to editor
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="rounded-full border border-rose-200 px-2 py-0.5 text-[0.7rem] text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/60 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                      onClick={async () => {
                                        if (
                                          !canManageShare ||
                                          !canModifyEntry(entry.role, entry.userId)
                                        ) {
                                          return;
                                        }
                                        const ok = await onRevokeShare(shareRoadmap.id, entry.userId);
                                        if (ok) {
                                          await fetchShares(shareRoadmap.id);
                                        }
                                      }}
                                      disabled={
                                        !canManageShare ||
                                        !canModifyEntry(entry.role, entry.userId)
                                      }
                                    >
                                      Revoke
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null}

          {isLoading ? (
            <div className="text-xs text-slate-400 dark:text-slate-500">Loading...</div>
          ) : null}
          <div className="space-y-2">
            {sortedRoadmaps.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No roadmaps yet.
              </div>
            ) : (
              sortedRoadmaps.map((roadmap) => renderRoadmapRow(roadmap))
            )}
          </div>

          <div
            className={
              isPlain
                ? 'space-y-2 pt-3'
                : 'rounded-md border border-slate-200 bg-slate-50/70 p-2 space-y-2 dark:border-slate-700 dark:bg-slate-800'
            }
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Create roadmap
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, MAX_NAME))}
                maxLength={MAX_NAME}
                placeholder="Roadmap name"
                className="w-48 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={async () => {
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  const ok = await onCreateRoadmap(trimmed, '');
                  if (ok) {
                    setName('');
                  }
                }}
                disabled={!name.trim()}
              >
                Create roadmap
              </button>
            </div>
          </div>
        </div>
      </SignedIn>
    </section>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-4 w-4 transition-transform duration-300 ${
        isOpen ? 'rotate-180' : ''
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

function AnimatedSection({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targetHeight = isOpen ? el.scrollHeight : 0;
    el.style.maxHeight = `${targetHeight}px`;
    el.style.opacity = isOpen ? '1' : '0';
    el.style.transform = isOpen ? 'translateY(0px) scale(1)' : 'translateY(-8px) scale(0.98)';
    el.style.marginTop = isOpen ? '0.6rem' : '0';
    el.style.pointerEvents = isOpen ? 'auto' : 'none';
  }, [isOpen, children]);

  return (
    <div
      ref={ref}
      style={{
        maxHeight: '0px',
        opacity: 0,
        transform: 'translateY(-8px) scale(0.98)',
        marginTop: '0',
        transition:
          'max-height 650ms ease-in-out, opacity 420ms ease-in-out, transform 420ms ease-in-out, margin 420ms ease-in-out',
        overflow: 'hidden',
        willChange: 'max-height, opacity, transform, margin',
      }}
      aria-hidden={!isOpen}
    >
      {children}
    </div>
  );
}
