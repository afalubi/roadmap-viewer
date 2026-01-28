import type { RoadmapItem } from '@/types/roadmap';

export function buildCsvFromItems(items: RoadmapItem[]): string {
  const headers = [
    'id',
    'title',
    'url',
    'impactedStakeholders',
    'submitterName',
    'submitterDepartment',
    'submitterPriority',
    'shortDescription',
    'longDescription',
    'criticality',
    'disposition',
    'executiveSponsor',
    'startDate',
    'endDate',
    'requestedDeliveryDate',
    'tShirtSize',
    'pillar',
    'region',
    'expenseType',
    'pointOfContact',
    'lead',
  ];
  const escapeValue = (value: string) => {
    const safe = value ?? '';
    if (/[",\n]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };
  const rows = items.map((item) =>
    [
      item.id,
      item.title,
      item.url,
      item.impactedStakeholders,
      item.submitterName,
      item.submitterDepartment,
      item.submitterPriority,
      item.shortDescription,
      item.longDescription,
      item.criticality,
      item.disposition,
      item.executiveSponsor,
      item.startDate,
      item.endDate,
      item.requestedDeliveryDate,
      item.tShirtSize,
      item.pillar,
      item.region,
      item.expenseType,
      item.pointOfContact,
      item.lead,
    ]
      .map(escapeValue)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}
