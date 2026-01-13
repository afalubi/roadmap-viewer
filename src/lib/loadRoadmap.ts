import type { RoadmapItem } from '@/types/roadmap';
import { loadRoadmapFromCsv } from './loadRoadmapFromCsv';

const DATA_SOURCE: 'csv' | 'azure' = 'csv';

export async function loadRoadmap(): Promise<RoadmapItem[]> {
  if (DATA_SOURCE === 'csv') {
    return loadRoadmapFromCsv();
  }
  return [];
}
