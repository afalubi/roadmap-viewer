export type RoadmapDatasourceType = 'csv' | 'azure-devops';

export type RoadmapFieldMap = Partial<{
  title: string;
  startDate: string;
  endDate: string;
  requestedDeliveryDate: string;
  pillar: string;
  region: string;
  criticality: string;
  disposition: string;
  url: string;
  impactedStakeholders: string;
  submitterName: string;
  submitterDepartment: string;
  submitterPriority: string;
  shortDescription: string;
  longDescription: string;
  executiveSponsor: string;
  expenseType: string;
  pointOfContact: string;
  lead: string;
  tShirtSize: string;
}>;

export type AzureDevopsQueryType = 'wiql' | 'saved';

export type AzureDevopsDateStrategy = 'fallback' | 'skip' | 'unplanned';

export type AzureDevopsQueryMode = 'simple' | 'advanced';

export type AzureDevopsQueryTemplate =
  | 'epics-features-active'
  | 'stories-active'
  | 'recently-changed';

export type AzureDevopsDatasourceConfig = {
  organizationUrl: string;
  project: string;
  team?: string | null;
  queryMode?: AzureDevopsQueryMode;
  queryTemplate?: AzureDevopsQueryTemplate;
  areaPath?: string;
  workItemTypes?: string[];
  includeClosed?: boolean;
  stakeholderTagPrefix?: string;
  regionTagPrefix?: string;
  queryType: AzureDevopsQueryType;
  queryText: string;
  refreshMinutes?: number;
  maxItems?: number;
  missingDateStrategy?: AzureDevopsDateStrategy;
  fieldMap?: RoadmapFieldMap;
};

export type RoadmapDatasourceConfig =
  | { type: 'csv' }
  | { type: 'azure-devops'; config: AzureDevopsDatasourceConfig };

export type RoadmapDatasourceSummary = {
  type: RoadmapDatasourceType;
  config: AzureDevopsDatasourceConfig | null;
  hasSecret: boolean;
  lastSyncAt: string | null;
  lastSyncDurationMs: number | null;
  lastSyncItemCount: number | null;
  lastSyncError: string | null;
  lastSnapshotAt: string | null;
};
