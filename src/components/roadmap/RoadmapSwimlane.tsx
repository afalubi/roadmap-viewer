'use client';

import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { RoadmapItem } from '@/types/roadmap';
import type { QuarterBucket } from '@/lib/timeScale';
import { getTimelinePosition } from '@/lib/timeScale';
import { getItemClassesByIndex, getLineFillClasses } from '@/lib/color';
import { getRegionFlagAssets } from '@/lib/region';

interface Props {
  pillar: string;
  items: RoadmapItem[];
  quarters: QuarterBucket[];
  onSelectItem: (item: RoadmapItem) => void;
  laneClassName: string;
  laneStyle?: CSSProperties;
  laneBodyClassName?: string;
  laneBodyStyle?: CSSProperties;
  timelinePadding?: number;
  laneSpacerClassName?: string;
  laneSpacerStyle?: CSSProperties;
  todayLeftPercent?: number | null;
  displayOptions: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
    itemVerticalPadding: number;
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
  laneIndex: number;
  itemStyle?: CSSProperties;
}

export function RoadmapSwimlane({
  pillar,
  items,
  quarters,
  onSelectItem,
  laneClassName,
  laneStyle,
  laneBodyClassName,
  laneBodyStyle,
  timelinePadding = 12,
  laneSpacerClassName,
  laneSpacerStyle,
  todayLeftPercent = null,
  displayOptions,
  theme,
  laneIndex,
  itemStyle,
}: Props) {
  const itemColorClasses = getItemClassesByIndex(laneIndex, theme);
  const lineFillClasses = getLineFillClasses(itemColorClasses);
  const lineBorderClasses = stripBgClasses(itemColorClasses);
  const laneClasses = laneClassName || 'bg-slate-50';
  const laneBodyClasses = laneBodyClassName || laneClasses;
  const [tooltip, setTooltip] = useState<{
    item: RoadmapItem;
    rect: DOMRect;
    regionBadges: ReactNode;
  } | null>(null);
  const titleAbove =
    displayOptions.titleAbove || displayOptions.itemStyle === 'line';
  const useDarkItemText =
    displayOptions.darkMode && theme !== 'executive' && theme !== 'metro-dark';
  const lanePaddingTop = titleAbove ? 20 : 8;
  const lanePaddingX = 8;
  const lanePaddingBottom = 8;
  const firstItemOffset = 4;
  const rowHeight =
    displayOptions.itemStyle === 'line'
      ? 18
      : displayOptions.showShortDescription
        ? 34
        : 24;
  const labelHeight = titleAbove ? 12 : 0;
  const rowGap = displayOptions.itemVerticalPadding;
  const laneRowHeight = rowHeight + rowGap + labelHeight;
  const timelineStart = quarters[0]?.start.getTime() ?? 0;
  const timelineEnd = quarters[quarters.length - 1]?.end.getTime() ?? 0;
  const positionedItems = buildLaneRows(items, timelineStart, timelineEnd);
  const lineRows =
    displayOptions.itemStyle === 'line'
      ? Array.from(new Set(positionedItems.items.map((entry) => entry.row)))
      : [];
  const laneHeight =
    positionedItems.maxRow >= 0
      ? lanePaddingTop +
        lanePaddingBottom +
        firstItemOffset +
        (positionedItems.maxRow + 1) * laneRowHeight
      : lanePaddingTop + lanePaddingBottom + firstItemOffset + rowHeight;

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `160px ${timelinePadding}px repeat(${quarters.length}, minmax(0, 1fr))`,
      }}
    >
      <div
        className={[
          'border-r border-slate-200 py-3 px-2 text-xs font-semibold text-slate-900 dark:border-slate-700',
          useDarkItemText ? 'dark:text-slate-900' : 'dark:text-slate-100',
          laneClasses,
        ].join(' ')}
        style={laneStyle}
      >
        {pillar}
      </div>
      <div
        className={laneSpacerClassName || laneBodyClasses}
        style={laneSpacerStyle}
      />

      <div
        className={['relative', laneBodyClasses].join(' ')}
        style={{ gridColumn: '3 / -1', minHeight: laneHeight, ...laneBodyStyle }}
      >
        <div
          className="relative h-full isolate"
          style={{
            paddingTop: lanePaddingTop,
            paddingBottom: lanePaddingBottom,
            paddingLeft: lanePaddingX,
            paddingRight: lanePaddingX,
          }}
        >
          {typeof todayLeftPercent === 'number' ? (
            <div
              className="absolute top-0 bottom-0 w-px bg-rose-300/50 z-10 pointer-events-none"
              style={{ left: `${todayLeftPercent}%` }}
            />
          ) : null}
          {positionedItems.items.map(({ item, row }) => {
            const pos = getTimelinePosition(item, quarters);
            if (pos.widthPercent <= 0) return null;
            const regionFlags = displayOptions.showRegionEmojis
              ? getRegionFlagAssets(item.region)
              : [];
            const regionBadges = regionFlags.length ? (
              <span
                className={[
                  'mr-1 inline-flex items-center gap-0.5 text-slate-800',
                  useDarkItemText ? 'dark:text-slate-800' : 'dark:text-slate-100',
                ].join(' ')}
              >
                {regionFlags.map((flag) => (
                  <span
                    key={`${item.id}-${flag.region}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-[0.6rem] leading-none"
                  >
                    <img
                      src={flag.src}
                      alt={flag.alt}
                      className="h-3 w-3 rounded-sm object-cover"
                      loading="lazy"
                    />
                  </span>
                ))}
              </span>
            ) : null;

            const hasInlineTitle = !titleAbove && item.title;
            const hasInlineShort =
              displayOptions.showShortDescription &&
              item.shortDescription &&
              displayOptions.itemStyle !== 'line';
            const hasInlineText = Boolean(hasInlineTitle || hasInlineShort);
            const lineHeight = displayOptions.itemStyle === 'line' ? 6 : 8;
            const itemTop =
              displayOptions.itemStyle === 'line'
                ? firstItemOffset + row * laneRowHeight
                : firstItemOffset +
                  row * laneRowHeight +
                  (hasInlineText ? 0 : Math.max(0, (rowHeight - lineHeight) / 2));

            const stackGap = titleAbove
              ? displayOptions.itemStyle === 'line'
                ? displayOptions.lineTitleGap
                : 4
              : 0;

            return (
              <div
                key={item.id}
                className="absolute z-40 flex flex-col"
                style={{
                  left: `${pos.leftPercent}%`,
                  width: `${pos.widthPercent}%`,
                  top: itemTop,
                  gap: `${stackGap}px`,
                }}
              >
                {titleAbove ? (
                  <div
                    className={[
                      "text-[0.7rem] font-semibold leading-none text-slate-800 truncate tracking-tight",
                      useDarkItemText ? 'dark:text-slate-800' : 'dark:text-slate-100',
                    ].join(' ')}
                    style={{ fontFamily: '"Inter Tight", "Inter", "Arial", sans-serif' }}
                  >
                    {regionBadges}
                    {item.title}
                  </div>
                ) : null}
                <button
                  type="button"
                  className={[
                    'group relative z-40 w-full text-left text-xs px-2 py-1 rounded-md border shadow-sm cursor-pointer transition-colors',
                    itemStyle ? 'hover:brightness-95' : '',
                    useDarkItemText ? 'text-slate-900 dark:text-slate-900' : 'text-slate-900 dark:text-slate-100',
                    displayOptions.itemStyle === 'line'
                      ? lineBorderClasses
                      : itemColorClasses,
                    displayOptions.itemStyle === 'line'
                      ? [
                          'h-1.5 py-0 rounded-full',
                          lineFillClasses.fill,
                          lineFillClasses.hover,
                        ].join(' ')
                      : hasInlineText
                        ? ''
                        : 'h-2 py-0 rounded-full',
                  ].join(' ')}
                  style={itemStyle}
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
                  {hasInlineText && !titleAbove ? (
                    <div className="font-semibold truncate">
                      {regionBadges}
                      {item.title}
                    </div>
                  ) : null}
                  {hasInlineText && displayOptions.showShortDescription ? (
                    <div
                      className={[
                        'text-[0.65rem] truncate text-slate-700',
                        useDarkItemText ? 'dark:text-slate-700' : 'dark:text-slate-200',
                      ].join(' ')}
                    >
                      {stripHtml(item.shortDescription)}
                    </div>
                  ) : null}
                </button>
              </div>
            );
          })}
          {lineRows.map((row) => {
            const lineTitleHeight = displayOptions.showRegionEmojis ? 16 : 12;
            const lineButtonHeight = 8;
            const lineThickness = 4;
            const lineTop =
              firstItemOffset +
              row * laneRowHeight +
              lineTitleHeight +
              displayOptions.lineTitleGap +
              (lineButtonHeight - lineThickness) / 2;

            return (
              <div
                key={`line-row-${row}`}
                className="absolute left-0 right-0 h-1 bg-slate-300 z-0 pointer-events-none dark:bg-slate-600"
                style={{ top: lineTop }}
              />
            );
          })}
        </div>
      </div>
      {tooltip && typeof document !== 'undefined'
        ? (() => {
            const showAbove = tooltip.rect.top > 120;
            return createPortal(
              <div
                className="pointer-events-none fixed z-50 w-56 rounded-md border border-slate-300 bg-white p-2 text-[0.7rem] text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {tooltip.regionBadges}
                  {tooltip.item.title}
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  {stripHtml(tooltip.item.shortDescription)}
                </div>
              </div>,
              document.body,
            );
          })()
        : null}
    </div>
  );
}

function stripBgClasses(classes: string): string {
  return classes
    .split(' ')
    .filter((cls) => !cls.startsWith('bg-') && !cls.startsWith('hover:bg-'))
    .join(' ');
}

function stripHtml(value: string): string {
  if (!value) return '';
  return value.replace(/<[^>]*>/g, '').trim();
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
