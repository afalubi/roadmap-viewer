export type TShirtSize = 'XS' | 'S' | 'M' | 'L';

export interface RoadmapItem {
  id: string;
  title: string;
  url: string;
  impactedStakeholders: string;
  submitterName: string;
  submitterDepartment: string;
  submitterPriority: string;
  shortDescription: string;
  longDescription: string;
  criticality: string;
  executiveSponsor: string;
  startDate: string;
  endDate: string;
  tShirtSize: TShirtSize;
  pillar: string;
  region: string;
  expenseType: string;
  pointOfContact: string;
  lead: string;
}
