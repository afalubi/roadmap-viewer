'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { getRegionFlagAssets } from '@/lib/region';
import { RoadmapItemDetailDialog } from '@/components/roadmap/RoadmapItemDetailDialog';

interface Props {
  items: RoadmapItem[];
  groupBy: 'pillar' | 'stakeholder' | 'criticality' | 'region' | 'disposition';
  showShortDescription: boolean;
  showRegionEmojis: boolean;
  layout: 'list' | 'board';
  onLayoutChange: (value: 'list' | 'board') => void;
  fullWidth: boolean;
  onFullWidthChange: (value: boolean) => void;
  exportSummary: {
    viewBy: string;
    titlePrefix: string;
    filters: string[];
  };
  isExporting: boolean;
  isLoading: boolean;
  showDebugOutlines?: boolean;
}

const GROUP_LABELS: Record<Props['groupBy'], string> = {
  pillar: 'Pillar',
  stakeholder: 'Sponsor',
  criticality: 'Criticality',
  region: 'Region',
  disposition: 'Disposition',
};

function getPriorityValue(item: RoadmapItem): number {
  const raw = String(item.submitterPriority ?? '').trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getGroupKey(item: RoadmapItem, groupBy: Props['groupBy']): string {
  if (groupBy === 'stakeholder') {
    const value = (item.executiveSponsor || '').trim();
    if (!value || value === '0') return 'Unspecified';
    return value;
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
  showRegionEmojis,
  layout,
  onLayoutChange,
  fullWidth,
  onFullWidthChange,
  exportSummary,
  isExporting,
  isLoading,
  showDebugOutlines = false,
}: Props) {
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState('');
  const normalizedQuery = searchText.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter((item) => {
      const haystack = [
        item.title,
        item.shortDescription,
        item.longDescription,
        item.submitterName,
        item.submitterDepartment,
        item.executiveSponsor,
        item.lead,
        item.pointOfContact,
        item.impactedStakeholders,
        item.pillar,
        item.region,
        item.expenseType,
        item.criticality,
        item.disposition,
        item.tShirtSize,
        item.url,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  const grouped = new Map<string, RoadmapItem[]>();
  for (const item of filteredItems) {
    const key = getGroupKey(item, groupBy) || 'Unassigned';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }
  const groups = Array.from(grouped.keys()).sort();
  const groupsKey = useMemo(() => groups.join('|'), [groups]);

  useEffect(() => {
    if (groups.length === 0) return;
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const group of groups) {
        if (next[group] === undefined) {
          next[group] = true;
        }
      }
      return next;
    });
  }, [groupsKey]);

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

      {isLoading ? (
        <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
          Loading unplanned work items...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
          No unplanned items match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-100">
              Unplanned Work By {GROUP_LABELS[groupBy]}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Filter items..."
                  className="w-44 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-sky-700"
                />
                {searchText ? (
                  <button
                    type="button"
                    onClick={() => setSearchText('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
                    aria-label="Clear text filter"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                {(["list", "board"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onLayoutChange(value)}
                    className={[
                      "px-3 py-1 rounded-full transition-colors",
                      layout === value
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
                    ].join(" ")}
                  >
                    {value === "list" ? "List" : "Board"}
                  </button>
                ))}
              </div>
              {layout === "board" ? (
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
              ) : null}
            </div>
          </div>

          {layout === "board" ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {groups.map((group) => {
                const groupItems = grouped.get(group) ?? [];
                const sortedItems = [...groupItems].sort((a, b) => {
                  const priorityDiff = getPriorityValue(a) - getPriorityValue(b);
                  if (priorityDiff !== 0) return priorityDiff;
                  return (a.title || '').localeCompare(b.title || '');
                });
                return (
                  <div
                    key={group}
                    className="min-w-[240px] w-64 flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {group}
                      </div>
                      <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                        {groupItems.length} item{groupItems.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {sortedItems.map((item) => (
                        <UnplannedCard
                          key={item.id}
                          item={item}
                          showShortDescription={showShortDescription}
                          showRegionEmojis={showRegionEmojis}
                          onOpen={setSelectedItem}
                          groupBy={groupBy}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => {
                const groupItems = grouped.get(group) ?? [];
                const sortedItems = [...groupItems].sort((a, b) => {
                  const priorityDiff = getPriorityValue(a) - getPriorityValue(b);
                  if (priorityDiff !== 0) return priorityDiff;
                  return (a.title || '').localeCompare(b.title || '');
                });
                const isOpen = openGroups[group] ?? true;
                return (
                  <div
                    key={group}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                      onClick={() =>
                        setOpenGroups((prev) => ({
                          ...prev,
                          [group]: !(prev[group] ?? true),
                        }))
                      }
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {group}
                      </div>
                      <div className="flex items-center gap-2 text-[0.7rem] text-slate-500 dark:text-slate-400">
                        <span>
                          {groupItems.length} item{groupItems.length === 1 ? '' : 's'}
                        </span>
                        <ChevronIcon isOpen={isOpen} />
                      </div>
                    </button>
                    <AnimatedSection isOpen={isOpen}>
                      <div className="grid gap-2">
                        {sortedItems.map((item) => (
                          <UnplannedCard
                            key={item.id}
                            item={item}
                            showShortDescription={showShortDescription}
                            showRegionEmojis={showRegionEmojis}
                            onOpen={setSelectedItem}
                            groupBy={groupBy}
                          />
                        ))}
                      </div>
                    </AnimatedSection>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <RoadmapItemDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        hideDates
      />
    </section>
  );
}

function UnplannedCard({
  item,
  showShortDescription,
  showRegionEmojis,
  onOpen,
  groupBy,
}: {
  item: RoadmapItem;
  showShortDescription: boolean;
  showRegionEmojis: boolean;
  onOpen: (item: RoadmapItem) => void;
  groupBy: Props['groupBy'];
}) {
  const criticality = (item.criticality || '').trim();
  const disposition = (item.disposition || '').trim();
  const regionFlags = showRegionEmojis ? getRegionFlagAssets(item.region) : [];
  const showCriticalityBadge = groupBy !== 'criticality';
  const showDispositionBadge = groupBy !== 'disposition';

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="text-left font-semibold text-slate-800 hover:text-slate-900 underline-offset-2 hover:underline dark:text-slate-100 dark:hover:text-white"
            >
              {item.title}
            </button>
            {regionFlags.length ? (
              <span className="inline-flex items-center gap-1">
                {regionFlags.map((flag) => (
                  <img
                    key={`${item.id}-${flag.region}`}
                    src={flag.src}
                    alt={flag.alt}
                    className="h-4 w-4 rounded-sm border border-white/60 shadow-sm"
                  />
                ))}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-500 dark:text-slate-400">
            {criticality && showCriticalityBadge ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[0.65rem] font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
                {criticality}
              </span>
            ) : null}
            {disposition && showDispositionBadge ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {disposition}
              </span>
            ) : null}
          </div>
          {showShortDescription ? null : null}
        </div>
        <div className="flex flex-col items-end gap-2" />
      </div>
    </div>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={[
        'h-3 w-3 transition-transform duration-300',
        isOpen ? 'rotate-180' : '',
      ].join(' ')}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function AnimatedSection({
  isOpen,
  children,
}: {
  isOpen: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targetHeight = isOpen ? el.scrollHeight : 0;
    el.style.maxHeight = `${targetHeight}px`;
    el.style.opacity = isOpen ? '1' : '0';
    el.style.transform = isOpen
      ? 'translateY(0px) scale(1)'
      : 'translateY(-8px) scale(0.98)';
    el.style.marginTop = isOpen ? '0.6rem' : '0';
    el.style.pointerEvents = isOpen ? 'auto' : 'none';
  }, [isOpen, children]);

  return (
    <div
      ref={ref}
      style={{
        maxHeight: '0px',
        opacity: 0,
        transform: 'translateY(-8px) scale(0.98)',
        marginTop: '0',
        transition:
          'max-height 650ms ease-in-out, opacity 420ms ease-in-out, transform 420ms ease-in-out, margin 420ms ease-in-out',
        overflow: 'hidden',
        willChange: 'max-height, opacity, transform, margin',
      }}
      aria-hidden={!isOpen}
    >
      {children}
    </div>
  );
}
