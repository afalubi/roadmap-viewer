export type TShirtSize = 'XS' | 'S' | 'M' | 'L';
export type TShirtSizeValue = TShirtSize | '';

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
  disposition: string;
  executiveSponsor: string;
  startDate: string;
  endDate: string;
  requestedDeliveryDate: string;
  tShirtSize: TShirtSizeValue;
  pillar: string;
  region: string;
  expenseType: string;
  pointOfContact: string;
  lead: string;
  tags: string;
}
