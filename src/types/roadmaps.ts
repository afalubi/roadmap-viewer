import type { RoadmapItem } from '@/types/roadmap';
import type { RoadmapThemeConfig } from '@/types/theme';

export type RoadmapRole = 'owner' | 'editor' | 'viewer';

export interface RoadmapSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  role: RoadmapRole;
  sharedSlug?: string | null;
}

export interface RoadmapDetail extends RoadmapSummary {
  csvText: string;
  datasourceType?: 'csv' | 'azure-devops';
  items?: RoadmapItem[];
  themeConfig?: RoadmapThemeConfig | null;
}
