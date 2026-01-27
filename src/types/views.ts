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
  mode?: 'planned' | 'unplanned';
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
