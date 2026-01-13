'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RoadmapItem } from '@/types/roadmap';
import type { QuarterBucket } from '@/lib/timeScale';
import { getTimelinePosition } from '@/lib/timeScale';
import { getItemClassesByIndex } from '@/lib/color';
import { getRegionEmojiList } from '@/lib/region';

interface Props {
  pillar: string;
  items: RoadmapItem[];
  quarters: QuarterBucket[];
  onSelectItem: (item: RoadmapItem) => void;
  laneClassName: string;
  laneBodyClassName?: string;
  displayOptions: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
  };
  theme: 'coastal' | 'orchard' | 'sunset';
  laneIndex: number;
}

export function RoadmapSwimlane({
  pillar,
  items,
  quarters,
  onSelectItem,
  laneClassName,
  laneBodyClassName,
  displayOptions,
  theme,
  laneIndex,
}: Props) {
  const itemColorClasses = getItemClassesByIndex(laneIndex, theme);
  const laneClasses = laneClassName || 'bg-slate-50';
  const laneBodyClasses = laneBodyClassName || laneClasses;
  const [tooltip, setTooltip] = useState<{
    item: RoadmapItem;
    rect: DOMRect;
    regionBadges: ReactNode;
  } | null>(null);
  const lanePaddingTop = displayOptions.titleAbove ? 20 : 8;
  const lanePaddingX = 8;
  const lanePaddingBottom = 8;
  const rowHeight = 24;
  const labelHeight = displayOptions.titleAbove ? 12 : 0;
  const rowGap = 6;
  const laneRowHeight = rowHeight + rowGap + labelHeight;
  const timelineStart = quarters[0]?.start.getTime() ?? 0;
  const timelineEnd = quarters[quarters.length - 1]?.end.getTime() ?? 0;

  const positionedItems = buildLaneRows(items, timelineStart, timelineEnd);
  const laneHeight =
    positionedItems.maxRow >= 0
      ? lanePaddingTop +
        lanePaddingBottom +
        (positionedItems.maxRow + 1) * laneRowHeight
      : lanePaddingTop + lanePaddingBottom + rowHeight;

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `160px repeat(${quarters.length}, minmax(0, 1fr))`,
      }}
    >
      <div
        className={[
          'border-r border-slate-200 py-3 px-2 text-xs font-semibold text-slate-900',
          laneClasses,
        ].join(' ')}
      >
        {pillar}
      </div>

      <div
        className={['relative', laneBodyClasses].join(' ')}
        style={{ gridColumn: '2 / -1', minHeight: laneHeight }}
      >
        <div
          className="relative h-full"
          style={{
            paddingTop: lanePaddingTop,
            paddingBottom: lanePaddingBottom,
            paddingLeft: lanePaddingX,
            paddingRight: lanePaddingX,
          }}
        >
          {positionedItems.items.map(({ item, row }) => {
            const pos = getTimelinePosition(item, quarters);
            if (pos.widthPercent <= 0) return null;
            const regionEmojis = displayOptions.showRegionEmojis
              ? getRegionEmojiList(item.region)
              : [];
            const regionBadges = regionEmojis.length ? (
              <span className="mr-1 inline-flex items-center gap-0.5">
                {regionEmojis.map((emoji) => (
                  <span
                    key={`${item.id}-${emoji}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-[0.6rem] leading-none"
                  >
                    {emoji}
                  </span>
                ))}
              </span>
            ) : null;

            const itemTop = row * laneRowHeight;

            return (
              <div
                key={item.id}
                className="absolute"
                style={{ left: `${pos.leftPercent}%`, width: `${pos.widthPercent}%`, top: itemTop }}
              >
                {displayOptions.titleAbove ? (
                  <div className="mb-1 text-[0.65rem] font-semibold text-slate-800 truncate">
                    {regionBadges}
                    {item.title}
                  </div>
                ) : null}
                <button
                  type="button"
                  className={[
                    'group w-full text-left text-xs px-2 py-1 rounded-md border shadow-sm cursor-pointer transition-colors',
                    itemColorClasses,
                  ].join(' ')}
                  onClick={() => onSelectItem(item)}
                  onMouseEnter={(event) =>
                    setTooltip({
                      item,
                      rect: event.currentTarget.getBoundingClientRect(),
                      regionBadges,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  {displayOptions.titleAbove ? null : (
                    <div className="font-semibold truncate">
                      {regionBadges}
                      {item.title}
                    </div>
                  )}
                  {displayOptions.showShortDescription ? (
                    <div className="text-[0.65rem] text-slate-700 truncate">
                      {item.shortDescription}
                    </div>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {tooltip && typeof document !== 'undefined'
        ? (() => {
            const showAbove = tooltip.rect.top > 120;
            return createPortal(
              <div
                className="pointer-events-none fixed z-50 w-56 rounded-md border border-slate-300 bg-white p-2 text-[0.7rem] text-slate-800 shadow-lg"
                style={{
                  left: Math.min(
                    tooltip.rect.left,
                    window.innerWidth - 224,
                  ),
                  top: showAbove ? tooltip.rect.top : tooltip.rect.bottom,
                  transform: showAbove
                    ? 'translateY(-8px) translateY(-100%)'
                    : 'translateY(8px)',
                }}
              >
                <div className="font-semibold text-slate-900">
                  {tooltip.regionBadges}
                  {tooltip.item.title}
                </div>
                <div className="text-slate-600">
                  {tooltip.item.shortDescription}
                </div>
              </div>,
              document.body,
            );
          })()
        : null}
    </div>
  );
}

function buildLaneRows(
  items: RoadmapItem[],
  timelineStart: number,
  timelineEnd: number,
): { items: Array<{ item: RoadmapItem; row: number }>; maxRow: number } {
  if (!timelineStart || !timelineEnd || timelineEnd <= timelineStart) {
    return { items: [], maxRow: -1 };
  }

  const sorted = [...items].sort((a, b) => {
    const aStart = new Date(a.startDate).getTime();
    const bStart = new Date(b.startDate).getTime();
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = new Date(a.endDate).getTime();
    const bEnd = new Date(b.endDate).getTime();
    return aEnd - bEnd;
  });

  const rows: number[] = [];
  const groupRows = new Map<string, number>();
  const positioned = sorted.map((item) => {
    const rawStart = new Date(item.startDate).getTime();
    const rawEnd = new Date(item.endDate).getTime();
    const start = Math.max(rawStart, timelineStart);
    const end = Math.min(rawEnd, timelineEnd);

    const groupKey = getTitlePrefix(item.title);
    const preferredRow = groupRows.get(groupKey);

    let rowIndex =
      typeof preferredRow === 'number' && rows[preferredRow] <= start
        ? preferredRow
        : rows.findIndex((rowEnd) => rowEnd <= start);
    if (rowIndex === -1) {
      rows.push(end);
      rowIndex = rows.length - 1;
    }

    rows[rowIndex] = end;
    groupRows.set(groupKey, rowIndex);

    return { item, row: rowIndex };
  });

  return { items: positioned, maxRow: rows.length - 1 };
}

function getTitlePrefix(title: string): string {
  const safe = (title || '').trim();
  if (!safe) return '';
  const [prefix] = safe.split(':', 1);
  return prefix.trim().toLowerCase();
}
