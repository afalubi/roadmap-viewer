'use client';

import { useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { buildQuarterBuckets } from '@/lib/timeScale';
import { getLaneClassesByIndex } from '@/lib/color';
import { RoadmapSwimlane } from './RoadmapSwimlane';
import { RoadmapItemDetailDialog } from './RoadmapItemDetailDialog';

interface Props {
  items: RoadmapItem[];
  groupBy: 'pillar' | 'stakeholder' | 'criticality';
  displayOptions: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
  };
  theme: 'coastal' | 'orchard' | 'sunset';
  startDate: string;
  quartersToShow: number;
}

const GROUP_LABELS: Record<'pillar' | 'stakeholder' | 'criticality', string> = {
  pillar: 'Pillar',
  stakeholder: 'Primary stakeholder',
  criticality: 'Criticality',
};

function getGroupKey(item: RoadmapItem, groupBy: Props['groupBy']): string {
  if (groupBy === 'stakeholder') {
    return item.submitterDepartment || '';
  }
  if (groupBy === 'criticality') {
    return item.criticality || '';
  }
  return item.pillar || '';
}

export function RoadmapTimeline({
  items,
  groupBy,
  displayOptions,
  theme,
  startDate,
  quartersToShow,
}: Props) {
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);

  const quarters = buildQuarterBuckets(items, quartersToShow, startDate);

  const pillarsMap = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    const key = getGroupKey(item, groupBy) || 'Unassigned';
    if (!pillarsMap.has(key)) pillarsMap.set(key, []);
    pillarsMap.get(key)!.push(item);
  }

  const pillars = Array.from(pillarsMap.keys()).sort();

  return (
    <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
      <div className="overflow-x-auto overflow-y-visible">
        <div className="min-w-full">
          <div
            className="grid border-b border-slate-200"
            style={{
              gridTemplateColumns: `160px repeat(${quarters.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="py-2 text-xs font-semibold text-slate-700 px-2">
              {GROUP_LABELS[groupBy]}
            </div>
            {quarters.map((q) => (
              <div
                key={q.label}
                className="py-2 text-xs font-medium text-slate-700 text-center"
              >
                {q.label}
              </div>
            ))}
          </div>

          <div
            className="divide-y divide-slate-100"
            style={{ ['--quarter-count' as string]: quarters.length }}
          >
            {pillars.map((pillar, index) => (
              <RoadmapSwimlane
                key={pillar}
                pillar={pillar}
                items={pillarsMap.get(pillar)!}
                quarters={quarters}
                onSelectItem={setSelectedItem}
                laneClassName={getLaneClassesByIndex(index, theme)}
                laneBodyClassName={[
                  getLaneClassesByIndex(index, theme),
                  'bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[length:calc(100%/var(--quarter-count))_100%]',
                ].join(' ')}
                displayOptions={displayOptions}
                theme={theme}
                laneIndex={index}
              />
            ))}
          </div>
        </div>
      </div>

      <RoadmapItemDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </section>
  );
}
