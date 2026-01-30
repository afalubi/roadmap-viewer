'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { FaCanadianMapleLeaf } from 'react-icons/fa';
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
    showBoldProjectBorders: boolean;
    boldProjectBorderColor: string;
    boldProjectBorderAlternateColor: string;
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
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [laneWidth, setLaneWidth] = useState(0);

  useEffect(() => {
    if (!laneRef.current) return;
    const updateWidth = () => {
      if (!laneRef.current) return;
      setLaneWidth(laneRef.current.getBoundingClientRect().width);
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(laneRef.current);
    return () => observer.disconnect();
  }, []);

  const lineTitleMaxWidthById = useMemo(() => {
    const map = new Map<string, number>();
    if (displayOptions.itemStyle !== 'line' || !laneWidth) return map;
    const rows = new Map<number, Array<{ id: string; left: number; title: string; regions: number }>>();

    positionedItems.items.forEach(({ item, row }) => {
      const pos = getTimelinePosition(item, quarters);
      if (pos.widthPercent <= 0) return;
      const regions = displayOptions.showRegionEmojis
        ? getRegionFlagAssets(item.region).length
        : 0;
      if (!rows.has(row)) rows.set(row, []);
      rows.get(row)!.push({
        id: item.id,
        left: pos.leftPercent,
        title: item.title ?? '',
        regions,
      });
    });

    rows.forEach((items) => {
      const sorted = items.sort((a, b) => a.left - b.left);
      sorted.forEach((item, index) => {
        const nextLeft = sorted[index + 1]?.left ?? 100;
        const availablePercent = Math.max(0, nextLeft - item.left);
        const availablePx = (availablePercent / 100) * laneWidth;
        const estimated = estimateTitleWidth(item.title, item.regions);
        if (estimated > availablePx) {
          map.set(item.id, Math.max(0, availablePx - 2));
        }
      });
    });

    return map;
  }, [displayOptions.itemStyle, displayOptions.showRegionEmojis, laneWidth, positionedItems.items, quarters]);
  const laneHeight =
    positionedItems.maxRow >= 0
      ? lanePaddingTop +
        lanePaddingBottom +
        firstItemOffset +
        (positionedItems.maxRow + 1) * laneRowHeight
      : lanePaddingTop + lanePaddingBottom + firstItemOffset + rowHeight;
  const defaultItemHex = extractHexFromClass(itemColorClasses);
  const defaultLineHex = extractHexFromClass(lineFillClasses.fill) ?? defaultItemHex;

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
        ref={laneRef}
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
                {renderRegionBadges(regionFlags, item.id)}
              </span>
            ) : null;

            const hasInlineTitle = !titleAbove && item.title;
            const hasInlineShort =
              displayOptions.showShortDescription &&
              item.shortDescription &&
              displayOptions.itemStyle !== 'line';
            const hasInlineText = Boolean(hasInlineTitle || hasInlineShort);
            const effortType = getEffortType(item.disposition);
            const itemFillColor =
              (itemStyle?.backgroundColor as string | undefined) ??
              defaultLineHex ??
              defaultItemHex;
            const shouldEmphasize =
              displayOptions.showBoldProjectBorders &&
              (effortType === 'project' || effortType === 'backlog');
            const resolvedBorderColor = shouldEmphasize
              ? adjustBorderColor(
                  displayOptions.boldProjectBorderColor,
                  displayOptions.boldProjectBorderAlternateColor,
                  itemFillColor,
                )
              : undefined;
            const lineHeight = displayOptions.itemStyle === 'line' ? 6 : 8;
            const itemTop =
              displayOptions.itemStyle === 'line'
                ? firstItemOffset + row * laneRowHeight + 2
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
                      'text-[0.7rem] font-semibold leading-none text-slate-800 tracking-tight',
                      useDarkItemText ? 'dark:text-slate-800' : 'dark:text-slate-100',
                      displayOptions.itemStyle === 'line' &&
                      lineTitleMaxWidthById.has(item.id)
                        ? 'truncate'
                        : 'overflow-visible whitespace-nowrap',
                    ].join(' ')}
                    style={{
                      fontFamily: '"Inter Tight", "Inter", "Arial", sans-serif',
                      maxWidth: lineTitleMaxWidthById.get(item.id)
                        ? `${lineTitleMaxWidthById.get(item.id)}px`
                        : undefined,
                    }}
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
                    shouldEmphasize
                      ? 'border-2'
                      : '',
                    displayOptions.itemStyle === 'line'
                      ? [
                          'h-1.5 py-0 rounded-full border',
                          lineFillClasses.fill,
                          lineFillClasses.hover,
                        ].join(' ')
                      : hasInlineText
                        ? ''
                        : 'h-2 py-0 rounded-full',
                  ].join(' ')}
                  style={{
                    ...itemStyle,
                    borderColor: resolvedBorderColor,
                  }}
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

function getEffortType(
  value?: string | null,
): 'discovery' | 'project' | 'backlog' | null {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('discovery')) return 'discovery';
  if (normalized.includes('project')) return 'project';
  if (normalized.includes('backlog')) return 'backlog';
  return null;
}

function estimateTitleWidth(title: string, regionCount: number): number {
  if (!title) return 0;
  const fontSizePx = 11.2;
  const avgCharWidth = fontSizePx * 0.45;
  const regionWidth = regionCount * 20;
  return Math.ceil(title.length * avgCharWidth + regionWidth + 8);
}

function extractHexFromClass(value: string): string | null {
  const match = value.match(/bg-\[#([0-9a-fA-F]{6})\](?:\/\d+)?/);
  return match ? `#${match[1]}` : null;
}

function adjustBorderColor(
  borderHex: string,
  alternateHex: string,
  itemHex?: string | null,
): string {
  const border = hexToRgb(borderHex);
  const alternate = hexToRgb(alternateHex);
  const item = itemHex ? hexToRgb(itemHex) : null;
  if (!border || !item) return borderHex;
  const distance = colorDistance(border, item);
  const contrast = contrastRatio(border, item);
  if (distance >= 40 && contrast >= 1.6) return borderHex;
  if (alternate) return alternateHex;
  const itemLum = relativeLuminance(item);
  const target = itemLum > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const adjusted = mixColors(border, target, 0.7);
  if (contrastRatio(adjusted, item) < 2.2) {
    return rgbToHex(target);
  }
  return rgbToHex(adjusted);
}

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  const hex = value.replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(value: { r: number; g: number; b: number }): string {
  const toHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(value.r)}${toHex(value.g)}${toHex(value.b)}`;
}

function mixColors(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  amount: number,
) {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function relativeLuminance(color: { r: number; g: number; b: number }): number {
  const transform = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const r = transform(color.r);
  const g = transform(color.g);
  const b = transform(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function renderRegionBadges(
  flags: Array<{ region: string; src: string; alt: string }>,
  id: string,
) {
  if (flags.length === 2) {
    const us = flags.find((flag) => flag.region === 'US');
    const ca = flags.find((flag) => flag.region === 'Canada');
    if (us && ca) {
      return (
        <span
          key={`${id}-combined-flag`}
          className="relative inline-flex h-3 w-5 items-center justify-center overflow-hidden border border-slate-200 bg-white"
          title="US + Canada"
        >
          <span
            className="absolute inset-y-0 left-0 w-1/2"
            style={{
              backgroundImage: `url(${us.src})`,
              backgroundSize: '280% 135%',
              backgroundPosition: '45% 50%',
              backgroundRepeat: 'no-repeat',
            }}
            aria-label={us.alt}
            role="img"
          />
          <span className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-center bg-white">
            <span className="relative h-full w-full overflow-hidden">
              <FaCanadianMapleLeaf className="absolute left-[-20%] top-1/2 h-3 w-3 -translate-y-1/2 text-red-600" />
            </span>
          </span>
        </span>
      );
    }
  }

  return flags.map((flag) => (
    <span
      key={`${id}-${flag.region}`}
      className="inline-flex h-3 w-5 items-center justify-center overflow-hidden border border-slate-200 bg-white/80 text-[0.6rem] leading-none"
    >
      <img
        src={flag.src}
        alt={flag.alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </span>
  ));
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
  const delimiterIndex = safe.search(/[:(]/);
  const prefix =
    delimiterIndex === -1 ? safe : safe.slice(0, delimiterIndex);
  return prefix.trim().toLowerCase();
}
