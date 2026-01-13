import Papa from 'papaparse';
import type { RoadmapItem, TShirtSize } from '@/types/roadmap';

const TSHIRT_NORMALIZATION: Record<string, TShirtSize> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
};

function normalizeTShirt(value: string): TShirtSize {
  const key = (value || '').trim().toLowerCase();
  return TSHIRT_NORMALIZATION[key] ?? 'M';
}

export async function loadRoadmapFromCsv(): Promise<RoadmapItem[]> {
  const res = await fetch('/data/roadmap.csv');
  const text = await res.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as Array<Record<string, string>>;

  return rows.map((row, index) => ({
    id: row.id || String(index),
    title: row.title ?? '',
    url: row.url ?? '',
    impactedStakeholders: row.impactedStakeholders ?? '',
    submitterName: row.submitterName ?? '',
    submitterDepartment: row.submitterDepartment ?? '',
    submitterPriority: row.submitterPriority ?? '',
    shortDescription: row.shortDescription ?? '',
    longDescription: row.longDescription ?? '',
    criticality: row.criticality ?? '',
    executiveSponsor: row.executiveSponsor ?? '',
    startDate: row.startDate ?? '',
    endDate: row.endDate ?? '',
    tShirtSize: normalizeTShirt(row.tShirtSize ?? 'M'),
    pillar: row.pillar ?? '',
    region: row.region ?? '',
    expenseType: row.expenseType ?? '',
    pointOfContact: row.pointOfContact ?? '',
    lead: row.lead ?? '',
  }));
}
