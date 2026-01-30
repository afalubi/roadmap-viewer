'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RoadmapItem } from '@/types/roadmap';
import { buildQuarterBuckets, buildWeekBuckets } from '@/lib/timeScale';
import { RoadmapItemDetailDialog } from './RoadmapItemDetailDialog';

type CapacityRole = 'lead' | 'sme';

interface Props {
  items: RoadmapItem[];
  startDate: string;
  quartersToShow: number;
  bucketSize: 'week' | 'quarter';
  roles: CapacityRole[];
  fullWidth: boolean;
  onFullWidthChange: (value: boolean) => void;
  onBucketSizeChange: (value: 'week' | 'quarter') => void;
  onRolesChange: (value: CapacityRole[]) => void;
}

interface BucketInfo {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

interface PersonRow {
  personKey: string;
  name: string;
  buckets: Map<string, RoadmapItem[]>;
}

export function CapacityView({
  items,
  startDate,
  quartersToShow,
  bucketSize,
  roles,
  fullWidth,
  onFullWidthChange,
  onBucketSizeChange,
  onRolesChange,
}: Props) {
  const [searchValue, setSearchValue] = useState('');
  const [styleMode, setStyleMode] = useState<'bold' | 'soft' | 'dashboard'>(
    'bold',
  );
  const [hoverCell, setHoverCell] = useState<{
    role: CapacityRole;
    person: string;
    bucketLabel: string;
    items: RoadmapItem[];
    rect: DOMRect;
    key: string;
  } | null>(null);
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);

  const bucketInfo = useMemo(() => {
    const quarters = buildQuarterBuckets([], quartersToShow, startDate);
    if (quarters.length === 0) return [] as BucketInfo[];
    const rangeStart = quarters[0].start;
    const rangeEnd = quarters[quarters.length - 1].end;
    if (bucketSize === 'week') {
      const weeks = buildWeekBuckets(rangeStart, rangeEnd);
      return weeks.map((week) => ({
        key: week.start.toISOString(),
        label: week.label,
        start: week.start,
        end: week.end,
      }));
    }
    return quarters.map((quarter) => ({
      key: quarter.start.toISOString(),
      label: quarter.label,
      start: quarter.start,
      end: quarter.end,
    }));
  }, [bucketSize, quartersToShow, startDate]);

  const rowsByRole = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const bucketKeys = bucketInfo.map((bucket) => bucket.key);

    const buildRows = (role: CapacityRole): PersonRow[] => {
      const map = new Map<string, PersonRow>();
      const field = role === 'lead' ? 'lead' : 'pointOfContact';

      for (const item of items) {
        const person = parseAssigneeFirst((item as any)[field] ?? '');
        if (!person) continue;
        const personKey = normalizePerson(person);
        if (!map.has(personKey)) {
          map.set(personKey, {
            personKey,
            name: person.trim(),
            buckets: new Map(bucketKeys.map((key) => [key, []])),
          });
        }
        const row = map.get(personKey)!;
        const itemStart = parseDate(item.startDate);
        const itemEnd = parseDate(item.endDate);
        if (!itemStart || !itemEnd) continue;
        for (const bucket of bucketInfo) {
          if (overlaps(itemStart, itemEnd, bucket.start, bucket.end)) {
            row.buckets.get(bucket.key)?.push(item);
          }
        }
      }

      const rows = Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      if (!normalizedSearch) return rows;
      return rows.filter((row) =>
        row.name.toLowerCase().includes(normalizedSearch),
      );
    };

    return {
      lead: roles.includes('lead') ? buildRows('lead') : [],
      sme: roles.includes('sme') ? buildRows('sme') : [],
    };
  }, [bucketInfo, items, roles, searchValue]);

  const roleSections: Array<{ role: CapacityRole; label: string }> = [];
  if (roles.includes('lead')) roleSections.push({ role: 'lead', label: 'Lead' });
  if (roles.includes('sme')) roleSections.push({ role: 'sme', label: 'SME' });

  const columnWidth =
    bucketSize === 'week'
      ? styleMode === 'dashboard'
        ? 'minmax(42px,1fr)'
        : styleMode === 'bold'
          ? 'minmax(34px,1fr)'
          : 'minmax(55px,1fr)'
      : styleMode === 'dashboard'
        ? 'minmax(70px,1fr)'
        : styleMode === 'bold'
          ? 'minmax(68px,1fr)'
          : 'minmax(80px,1fr)';
  const monthGroups = useMemo(
    () => (bucketSize === 'week' ? buildMonthGroups(bucketInfo) : []),
    [bucketInfo, bucketSize],
  );
  const quarterGroups = useMemo(
    () => (bucketSize === 'week' ? buildQuarterGroups(bucketInfo) : []),
    [bucketInfo, bucketSize],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Roles
          </span>
          {(['lead', 'sme'] as CapacityRole[]).map((role) => (
            <label key={role} className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={roles.includes(role)}
                onChange={(event) => {
                  if (event.target.checked) {
                    onRolesChange(Array.from(new Set([...roles, role])));
                  } else {
                    onRolesChange(roles.filter((item) => item !== role));
                  }
                }}
              />
              {role === 'lead' ? 'Lead' : 'SME'}
            </label>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Person
          </span>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search people"
            className="w-48 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <label className="inline-flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <span>Use full width</span>
          <span className="relative inline-flex h-5 w-10 items-center">
            <input
              type="checkbox"
              checked={fullWidth}
              onChange={(event) => onFullWidthChange(event.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-full bg-slate-200 transition peer-checked:bg-sky-600 dark:bg-slate-700 dark:peer-checked:bg-sky-400" />
            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 dark:bg-slate-900 dark:peer-checked:bg-slate-900" />
          </span>
        </label>
      </div>

      {roleSections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Select at least one role to view capacity.
        </div>
      ) : null}

      {roleSections.map((section) => {
        const rows = rowsByRole[section.role];
        return (
          <div key={section.role} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {section.label}
            </div>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                No assigned {section.label.toLowerCase()} entries found.
              </div>
            ) : (
              <div
                className={[
                  'overflow-x-auto rounded-xl border',
                  styleMode === 'dashboard'
                    ? 'border-transparent bg-transparent'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
                ].join(' ')}
              >
                <div
                  className={[
                    'grid text-xs',
                    styleMode === 'dashboard'
                      ? 'gap-1'
                      : '',
                  ].join(' ')}
                  style={{
                    gridTemplateColumns: `200px repeat(${bucketInfo.length}, ${columnWidth})`,
                  }}
                >
                  {bucketSize === 'week' ? (
                    <>
                      <div className={[
                        'sticky left-0 z-10 border-b border-r px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wide',
                        styleMode === 'bold'
                          ? 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200'
                          : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500',
                      ].join(' ')}>
                        Quarter
                      </div>
                      {quarterGroups.map((group) => (
                        <div
                          key={`quarter-${section.role}-${group.key}`}
                          className={[
                            'border-b border-r-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide',
                            styleMode === 'bold'
                              ? 'border-slate-300 bg-slate-100 px-1 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:border-r-slate-600'
                              : 'border-slate-200 px-2 py-2 text-slate-400 dark:border-slate-700 dark:text-slate-500 dark:border-r-slate-600',
                          ].join(' ')}
                          style={{ gridColumn: `span ${group.count}` }}
                        >
                          {group.label}
                        </div>
                      ))}
                      <div className={[
                        'sticky left-0 z-10 border-b border-r text-[0.65rem] font-semibold uppercase tracking-wide',
                        styleMode === 'bold'
                          ? 'border-slate-300 bg-slate-100 px-2 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200'
                          : 'border-slate-200 bg-white px-3 py-2 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500',
                      ].join(' ')}>
                        Month
                      </div>
                      {monthGroups.map((group) => (
                        <div
                          key={`month-${section.role}-${group.key}`}
                        className={[
                          'border-b border-r text-[0.65rem] font-semibold uppercase tracking-wide flex items-center justify-center',
                          styleMode === 'bold'
                            ? 'border-slate-300 bg-slate-50 px-1 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
                            : 'border-slate-200 px-2 py-2 text-slate-400 dark:border-slate-700 dark:text-slate-500',
                          'dark:border-r-slate-600',
                        ].join(' ')}
                          style={{ gridColumn: `span ${group.count}` }}
                        >
                          {group.label}
                        </div>
                      ))}
                    </>
                  ) : null}
                  <div className={[
                    'sticky left-0 z-10 border-b border-r text-[0.7rem] font-semibold uppercase tracking-wide',
                    styleMode === 'bold'
                      ? 'border-slate-300 bg-slate-50 px-2 py-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
                      : 'border-slate-200 bg-white px-3 py-4 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
                  ].join(' ')}>
                    Person
                  </div>
                  {bucketInfo.map((bucket) => {
                    const isMonthBoundary = bucket.start.getUTCDate() <= 7;
                    const isQuarterBoundary =
                      bucket.start.getUTCMonth() % 3 === 0 && isMonthBoundary;
                    return (
                      <div
                        key={`${section.role}-head-${bucket.key}`}
                        className={[
                          'border-b text-center text-[0.7rem] font-semibold uppercase tracking-wide',
                          styleMode === 'bold'
                            ? 'border-slate-300 bg-slate-50 px-0.5 py-4.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
                            : 'border-slate-200 px-1 py-6 text-slate-500 dark:border-slate-700 dark:text-slate-400',
                          isMonthBoundary
                            ? 'border-r border-slate-300 dark:border-slate-600'
                            : 'border-r border-slate-100 dark:border-slate-800',
                          isQuarterBoundary
                            ? 'border-r-2 border-slate-400 dark:border-slate-500'
                            : '',
                        ].join(' ')}
                      >
                        <span className="inline-flex h-full w-full items-center justify-center origin-center -rotate-90 whitespace-nowrap">
                          {bucket.label}
                        </span>
                      </div>
                    );
                  })}
                  {rows.map((row) => (
                    <div
                      key={`${section.role}-${row.personKey}`}
                      className="contents"
                    >
                      <div className={[
                        'sticky left-0 z-10 border-r text-[0.7rem] font-semibold',
                        styleMode === 'dashboard'
                          ? 'border-transparent bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-md'
                          : styleMode === 'bold'
                            ? 'border-slate-300 bg-white px-2 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                            : 'border-slate-200 bg-white px-3 py-2 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
                      ].join(' ')}>
                        {row.name}
                      </div>
                      {bucketInfo.map((bucket) => {
                        const bucketItems = row.buckets.get(bucket.key) ?? [];
                        const count = bucketItems.length;
                        const intensity = heatmapClass(count);
                        const cellKey = `${section.role}-${row.personKey}-${bucket.key}`;
                        const isMonthBoundary = bucket.start.getUTCDate() <= 7;
                        const isQuarterBoundary =
                          bucket.start.getUTCMonth() % 3 === 0 && isMonthBoundary;
                        return (
                          <button
                            type="button"
                            key={cellKey}
                            className={[
                              'border-l text-center text-[0.7rem] transition',
                              styleMode === 'dashboard'
                                ? 'border-transparent rounded-md px-1 py-1 shadow-sm shadow-slate-200/50 dark:shadow-slate-900/40'
                                : styleMode === 'bold'
                                  ? 'border-slate-200 px-0.5 py-0.5'
                                  : 'border-slate-100 px-1 py-1',
                              count
                                ? 'text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'
                                : 'text-slate-400',
                              styleMode === 'soft' && count ? intensity : '',
                              styleMode === 'bold' && count ? intensity : '',
                              bucketSize === 'week'
                                ? isQuarterBoundary
                                  ? 'border-r-2 border-slate-400 dark:border-slate-500'
                                  : isMonthBoundary
                                    ? 'border-r border-slate-300 dark:border-slate-600'
                                    : 'border-r border-slate-100 dark:border-slate-800'
                                : '',
                            ].join(' ')}
                            onClick={(event) => {
                              if (!count) return;
                              if (hoverCell?.key === cellKey) {
                                setHoverCell(null);
                                return;
                              }
                              setHoverCell({
                                role: section.role,
                                person: row.name,
                                bucketLabel: bucket.label,
                                items: bucketItems,
                                rect: event.currentTarget.getBoundingClientRect(),
                                key: cellKey,
                              });
                            }}
                            disabled={!count}
                          >
                            {count ? count : '–'}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {hoverCell && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-auto fixed z-[210] w-64 rounded-lg border border-slate-200 bg-white p-3 text-[0.7rem] text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              style={{
                left: Math.min(hoverCell.rect.left, window.innerWidth - 280),
                top: hoverCell.rect.bottom + 6,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {hoverCell.person} · {hoverCell.bucketLabel}
                </div>
                <button
                  type="button"
                  className="text-[0.65rem] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  onClick={() => setHoverCell(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="text-[0.65rem] text-slate-500 dark:text-slate-400">
                {hoverCell.role === 'lead' ? 'Lead' : 'SME'} assignments
              </div>
              <div className="mt-2 space-y-1">
                {hoverCell.items.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-[0.7rem] text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                    onClick={() => setSelectedItem(item)}
                  >
                    <span className="text-[0.7rem] text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
                      ↗
                    </span>
                    {item.title}
                  </button>
                ))}
                {hoverCell.items.length > 6 ? (
                  <div className="text-[0.65rem] text-slate-500 dark:text-slate-400">
                    +{hoverCell.items.length - 6} more
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

      <RoadmapItemDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </section>
  );
}

function parseAssigneeFirst(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/[;,\/&\n]+/);
  const first = (parts[0] ?? '').trim();
  return first || null;
}

function normalizePerson(value: string): string {
  return value.trim().toLowerCase();
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function overlaps(
  start: Date,
  end: Date,
  bucketStart: Date,
  bucketEnd: Date,
): boolean {
  return start.getTime() <= bucketEnd.getTime() && end.getTime() >= bucketStart.getTime();
}

function formatDateRange(start: string, end: string): string {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return 'Dates TBD';
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  };
  return `${startDate.toLocaleDateString('en-US', options)} – ${endDate.toLocaleDateString('en-US', options)}`;
}

function buildMonthGroups(buckets: BucketInfo[]) {
  return groupBuckets(buckets, (bucket) =>
    bucket.start.toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  );
}

function buildQuarterGroups(buckets: BucketInfo[]) {
  return groupBuckets(buckets, (bucket) => {
    const month = bucket.start.getUTCMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `Q${quarter} ${bucket.start.getUTCFullYear()}`;
  });
}

function groupBuckets(
  buckets: BucketInfo[],
  getLabel: (bucket: BucketInfo) => string,
) {
  const groups: Array<{ key: string; label: string; count: number }> = [];
  for (const bucket of buckets) {
    const label = getLabel(bucket);
    const key = `${label}-${bucket.start.toISOString()}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.count += 1;
    } else {
      groups.push({ key, label, count: 1 });
    }
  }
  return groups;
}

function heatmapClass(count: number): string {
  if (count >= 6) {
    return 'bg-rose-200/80 dark:bg-rose-700/40';
  }
  if (count >= 4) {
    return 'bg-amber-200/80 dark:bg-amber-700/40';
  }
  if (count >= 2) {
    return 'bg-amber-100/80 dark:bg-amber-800/35';
  }
  if (count === 1) {
    return 'bg-slate-50 dark:bg-slate-800/40';
  }
  return '';
}
