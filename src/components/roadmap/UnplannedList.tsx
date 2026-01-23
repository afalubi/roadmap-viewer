'use client';

import type { RoadmapItem } from '@/types/roadmap';

interface Props {
  items: RoadmapItem[];
  groupBy: 'pillar' | 'stakeholder' | 'criticality' | 'region' | 'disposition';
  showShortDescription: boolean;
  exportSummary: {
    viewBy: string;
    titlePrefix: string;
    filters: string[];
  };
  isExporting: boolean;
  showDebugOutlines?: boolean;
}

const GROUP_LABELS: Record<Props['groupBy'], string> = {
  pillar: 'Pillar',
  stakeholder: 'Primary stakeholder',
  criticality: 'Criticality',
  region: 'Region',
  disposition: 'Disposition',
};

function getGroupKey(item: RoadmapItem, groupBy: Props['groupBy']): string {
  if (groupBy === 'stakeholder') {
    return item.submitterDepartment || '';
  }
  if (groupBy === 'criticality') {
    return item.criticality || '';
  }
  if (groupBy === 'region') {
    return item.region || '';
  }
  if (groupBy === 'disposition') {
    return item.disposition || '';
  }
  return item.pillar || '';
}

export function UnplannedList({
  items,
  groupBy,
  showShortDescription,
  exportSummary,
  isExporting,
  showDebugOutlines = false,
}: Props) {
  const grouped = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    const key = getGroupKey(item, groupBy) || 'Unassigned';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  const groups = Array.from(grouped.keys()).sort();

  return (
    <section
      id="roadmap-export"
      className={[
        'relative bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4 dark:bg-slate-900 dark:border-slate-700',
        showDebugOutlines
          ? 'outline outline-1 outline-dashed outline-cyan-300/80'
          : '',
      ].join(' ')}
    >
      {showDebugOutlines ? (
        <span className="absolute -top-3 left-2 rounded bg-cyan-100 px-1 text-[10px] font-semibold text-cyan-800">
          UNPLANNED
        </span>
      ) : null}
      {isExporting ? (
        <div className="space-y-1 border border-slate-200 rounded-md bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {exportSummary.titlePrefix}
          </div>
          <div className="text-[0.7rem] text-slate-600 dark:text-slate-300">
            {exportSummary.filters.length > 0
              ? exportSummary.filters.join(' · ')
              : ''}
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
          No unplanned items match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const groupItems = grouped.get(group) ?? [];
            return (
              <div
                key={group}
                className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    {GROUP_LABELS[groupBy]}: {group}
                  </div>
                  <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                    {groupItems.length} item{groupItems.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {groupItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {item.title}
                          </div>
                          {showShortDescription && item.shortDescription ? (
                            <div className="text-slate-600 dark:text-slate-300">
                              {item.shortDescription}
                            </div>
                          ) : null}
                        </div>
                        {item.url ? (
                          <a
                            href={item.url}
                            className="text-sky-700 hover:text-sky-900 underline underline-offset-2 dark:text-sky-300 dark:hover:text-sky-200"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open in DevOps
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-slate-500 dark:text-slate-400">
                        {item.pillar ? <span>Pillar: {item.pillar}</span> : null}
                        {item.region ? <span>Region: {item.region}</span> : null}
                        {item.criticality ? (
                          <span>Criticality: {item.criticality}</span>
                        ) : null}
                        {item.disposition ? (
                          <span>Disposition: {item.disposition}</span>
                        ) : null}
                        {item.submitterDepartment ? (
                          <span>Dept: {item.submitterDepartment}</span>
                        ) : null}
                        {item.submitterName ? (
                          <span>Submitter: {item.submitterName}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
