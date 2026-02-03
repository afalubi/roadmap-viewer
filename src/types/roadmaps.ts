import type { RoadmapItem } from '@/types/roadmap';
import type { RoadmapThemeConfig } from '@/types/theme';

export type RoadmapRole = 'owner' | 'editor' | 'viewer';

export interface RoadmapSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  role: RoadmapRole;
}

export interface RoadmapDetail extends RoadmapSummary {
  csvText: string;
  displayTitle?: string | null;
  datasourceType?: 'csv' | 'azure-devops';
  items?: RoadmapItem[];
  themeConfig?: RoadmapThemeConfig | null;
}
