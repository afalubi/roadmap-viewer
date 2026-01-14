import type { Region } from '@/lib/region';

export type ViewScope = 'personal' | 'shared';

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
  | 'slate'
  | 'sand'
  | 'mist'
  | 'mono'
  | 'forest'
  | 'metro'
  | 'metro-dark'
  | 'executive';

export type GroupByOption = 'pillar' | 'stakeholder' | 'criticality' | 'region';

export interface ViewPayload {
  filters: {
    pillars: string[];
    regions: Region[];
    criticalities: string[];
    impactedStakeholders: string[];
  };
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
  scope: ViewScope;
  payload: ViewPayload;
  sharedSlug?: string | null;
  createdAt: string;
  updatedAt: string;
}
