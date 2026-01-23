'use client';

import { useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { buildMonthBuckets, buildQuarterBuckets } from '@/lib/timeScale';
import {
  getItemClassesByIndex,
  getLaneBackgroundClassFromItem,
  getLaneClassesByIndex,
  getLaneHeaderClassesByIndex,
} from '@/lib/color';
import { RoadmapSwimlane } from './RoadmapSwimlane';
import { RoadmapItemDetailDialog } from './RoadmapItemDetailDialog';

interface Props {
  items: RoadmapItem[];
  groupBy: 'pillar' | 'stakeholder' | 'criticality' | 'region' | 'disposition';
  displayOptions: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
    itemVerticalPadding: number;
    laneDividerOpacity: number;
    itemStyle: 'tile' | 'line';
    lineTitleGap: number;
    showQuarters: boolean;
    showMonths: boolean;
    darkMode: boolean;
  };
  theme:
    | 'coastal'
    | 'orchard'
    | 'sunset'
    | 'sand'
    | 'mono'
    | 'forest'
    | 'metro'
    | 'metro-dark'
    | 'executive';
  startDate: string;
  quartersToShow: number;
  exportSummary: {
    viewBy: string;
    titlePrefix: string;
    filters: string[];
  };
  isExporting: boolean;
  showDebugOutlines?: boolean;
}

const GROUP_LABELS: Record<
  'pillar' | 'stakeholder' | 'criticality' | 'region' | 'disposition',
  string
> = {
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

export function RoadmapTimeline({
  items,
  groupBy,
  displayOptions,
  theme,
  startDate,
  quartersToShow,
  exportSummary,
  isExporting,
  showDebugOutlines = false,
}: Props) {
  const labelWidth = 160;
  const timelinePadding = 8;
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);

  const quarters = buildQuarterBuckets(items, quartersToShow, startDate);
  const timelineStart = quarters[0]?.start ?? null;
  const timelineEnd = quarters[quarters.length - 1]?.end ?? null;
  const months =
    displayOptions.showMonths && timelineStart && timelineEnd
      ? buildMonthBuckets(timelineStart, timelineEnd)
      : [];
  const todayLeft = getTodayLeftPercent(quarters);
  const dividerPalette = displayOptions.darkMode
    ? {
        lane: `rgba(148, 163, 184, ${displayOptions.laneDividerOpacity})`,
        quarter: 'rgba(148, 163, 184, 0.3)',
        month: 'rgba(148, 163, 184, 0.18)',
      }
    : {
        lane: `rgba(15, 23, 42, ${displayOptions.laneDividerOpacity})`,
        quarter: 'rgba(15, 23, 42, 0.12)',
        month: 'rgba(15, 23, 42, 0.06)',
      };

  const pillarsMap = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    const key = getGroupKey(item, groupBy) || 'Unassigned';
    if (!pillarsMap.has(key)) pillarsMap.set(key, []);
    pillarsMap.get(key)!.push(item);
  }

  const pillars = Array.from(pillarsMap.keys()).sort();

  return (
    <section
      id="roadmap-export"
      className={[
        "relative bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4 dark:bg-slate-900 dark:border-slate-700",
        showDebugOutlines
          ? "outline outline-1 outline-dashed outline-cyan-300/80"
          : "",
      ].join(" ")}
    >
      {showDebugOutlines ? (
        <span className="absolute -top-3 left-2 rounded bg-cyan-100 px-1 text-[10px] font-semibold text-cyan-800">
          ROADMAP
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
      <div
        className="overflow-x-auto overflow-y-visible"
        data-roadmap-scroll
      >
        <div className="min-w-full">
          <div className="relative space-y-1">
            {displayOptions.showQuarters ? (
              <div
                className="grid border-b border-slate-200 dark:border-slate-700"
                style={{
                  gridTemplateColumns: `${labelWidth}px ${timelinePadding}px repeat(${quarters.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="py-2 text-xs font-semibold text-slate-700 px-2 dark:text-slate-200">
                  {GROUP_LABELS[groupBy]}
                </div>
                <div className="bg-white dark:bg-slate-900" />
                {quarters.map((q) => (
                  <div
                    key={q.label}
                    className="py-2 text-xs font-semibold text-slate-700 text-center dark:text-slate-200"
                  >
                    {q.label}
                  </div>
                ))}
              </div>
            ) : null}
            {displayOptions.showMonths && timelineStart && timelineEnd ? (
              <div className="relative h-5">
                <div
                  className="absolute inset-y-0"
                  style={{ left: labelWidth + timelinePadding, right: 0 }}
                >
                  {months.map((month, index) => {
                    const total =
                      timelineEnd.getTime() - timelineStart.getTime() || 1;
                    const nextStart =
                      months[index + 1]?.start.getTime() ??
                      timelineEnd.getTime();
                    const mid =
                      (month.start.getTime() + nextStart) / 2;
                    const left =
                      ((mid - timelineStart.getTime()) / total) *
                      100;
                    return (
                      <div
                        key={month.label}
                        className="absolute text-[10px] text-slate-500 dark:text-slate-400"
                        style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
                      >
                        {month.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div
              className="divide-y divide-[color:var(--lane-divider)]"
              style={{
                ['--quarter-count' as string]: quarters.length,
                ['--month-count' as string]: months.length || 1,
                ['--lane-divider' as string]: dividerPalette.lane,
                ['--quarter-divider' as string]: dividerPalette.quarter,
                ['--month-divider' as string]: dividerPalette.month,
              }}
            >
              {pillars.map((pillar, index) => {
                const itemClasses = getItemClassesByIndex(index, theme);
                const laneBgClass =
                  theme === 'executive' || theme === 'mono'
                    ? getLaneHeaderClassesByIndex(index, theme)
                    : getLaneBackgroundClassFromItem(itemClasses);
                return (
                  <RoadmapSwimlane
                    key={pillar}
                    pillar={pillar}
                    items={pillarsMap.get(pillar)!}
                    quarters={quarters}
                    onSelectItem={setSelectedItem}
                    laneClassName={laneBgClass}
                    laneBodyClassName={[
                      getLaneClassesByIndex(index, theme),
                      displayOptions.showMonths && displayOptions.showQuarters
                        ? 'bg-[repeating-linear-gradient(to_right,var(--quarter-divider)_0,var(--quarter-divider)_1px,transparent_1px,transparent_calc(100%/var(--quarter-count))),repeating-linear-gradient(to_right,var(--month-divider)_0,var(--month-divider)_1px,transparent_1px,transparent_calc(100%/var(--month-count)))]'
                        : displayOptions.showMonths
                          ? 'bg-[repeating-linear-gradient(to_right,var(--month-divider)_0,var(--month-divider)_1px,transparent_1px,transparent_calc(100%/var(--month-count)))]'
                          : displayOptions.showQuarters
                            ? 'bg-[repeating-linear-gradient(to_right,var(--quarter-divider)_0,var(--quarter-divider)_1px,transparent_1px,transparent_calc(100%/var(--quarter-count)))]'
                            : '',
                    ].join(' ')}
                  laneSpacerClassName={getLaneClassesByIndex(index, theme)}
                  timelinePadding={timelinePadding}
                  todayLeftPercent={todayLeft}
                  displayOptions={displayOptions}
                  theme={theme}
                  laneIndex={index}
                />
                );
              })}
            </div>
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

function getTodayLeftPercent(quarters: Array<{ start: Date; end: Date }>): number | null {
  if (quarters.length === 0) return null;
  const timelineStart = quarters[0].start.getTime();
  const timelineEnd = quarters[quarters.length - 1].end.getTime();
  const now = Date.now();
  if (now < timelineStart || now > timelineEnd) return null;
  const totalDuration = timelineEnd - timelineStart || 1;
  return ((now - timelineStart) / totalDuration) * 100;
}
