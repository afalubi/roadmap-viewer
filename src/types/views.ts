import type { Region } from '@/lib/region';

export type ViewRole = 'owner' | 'editor' | 'viewer';

export interface DisplayOptions {
  showRegionEmojis: boolean;
  showShortDescription: boolean;
  titleAbove: boolean;
  itemVerticalPadding: number;
  laneDividerOpacity: number;
  itemStyle: 'tile' | 'line';
  lineTitleGap: number;
  showQuarters: boolean;
  showMonths: boolean;
  showDynamicHeader: boolean;
  darkMode: boolean;
  showBoldProjectBorders: boolean;
  boldProjectBorderColor: string;
  boldProjectBorderAlternateColor: string;
}

export type ThemeOption =
  | 'coastal'
  | 'orchard'
  | 'sunset'
  | 'sand'
  | 'mono'
  | 'forest'
  | 'metro'
  | 'metro-dark'
  | 'executive';

export type GroupByOption =
  | 'pillar'
  | 'stakeholder'
  | 'criticality'
  | 'region'
  | 'disposition';

export interface ViewPayload {
  filters: {
    pillars: string[];
    regions: Region[];
    criticalities: string[];
    dispositions: string[];
    primaryStakeholders: string[];
    impactedStakeholders: string[];
  };
  mode?: 'planned' | 'unplanned' | 'capacity';
  display: {
    groupBy: GroupByOption;
    theme: ThemeOption;
    titlePrefix: string;
    options: DisplayOptions;
  };
  timeline: {
    startDate: string;
    quartersToShow: number;
  };
  capacity?: {
    bucketSize: 'week' | 'quarter';
    roles: Array<'lead' | 'sme'>;
  };
}

export interface SavedView {
  id: string;
  name: string;
  roadmapId: string;
  payload: ViewPayload;
  sharedSlug?: string | null;
  createdAt: string;
  updatedAt: string;
  role: ViewRole;
}
