import Papa from 'papaparse';
import type { RoadmapItem, TShirtSize } from '@/types/roadmap';
import {
  normalizeRegionList,
  normalizeStakeholders,
  normalizeTitleCase,
} from '@/lib/normalizeFields';

const TSHIRT_NORMALIZATION: Record<string, TShirtSize> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
};

function normalizeTShirt(value: string): TShirtSize | '' {
  const key = (value || '').trim().toLowerCase();
  return TSHIRT_NORMALIZATION[key] ?? '';
}

export async function loadRoadmapFromCsv(): Promise<RoadmapItem[]> {
  const res = await fetch('/data/roadmap.csv');
  const text = await res.text();

  return parseRoadmapCsv(text);
}

export function parseRoadmapCsv(text: string): RoadmapItem[] {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as Array<Record<string, string>>;

  return rows.map((row, index) => ({
    id: row.id || String(index),
    title: row.title ?? '',
    url: row.url ?? '',
    impactedStakeholders: normalizeStakeholders(row.impactedStakeholders ?? ''),
    submitterName: row.submitterName ?? '',
    submitterDepartment: row.submitterDepartment ?? '',
    submitterPriority: row.submitterPriority ?? '',
    shortDescription: row.shortDescription ?? '',
    longDescription: row.longDescription ?? '',
    criticality: normalizeTitleCase(row.criticality ?? ''),
    disposition: normalizeTitleCase(row.disposition ?? ''),
    executiveSponsor: row.executiveSponsor ?? '',
    startDate: row.startDate ?? '',
    endDate: row.endDate ?? '',
    requestedDeliveryDate: row.requestedDeliveryDate ?? '',
    tShirtSize: normalizeTShirt(row.tShirtSize ?? ''),
    pillar: normalizeTitleCase(row.pillar ?? ''),
    region: normalizeRegionList(row.region ?? ''),
    expenseType: row.expenseType ?? '',
    pointOfContact: row.pointOfContact ?? '',
    lead: row.lead ?? '',
  }));
}
