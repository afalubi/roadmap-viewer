'use client';

import type React from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import type { Region } from '@/lib/region';
import { parseStakeholders } from '@/lib/stakeholders';

interface Props {
  items: RoadmapItem[];
  selectedPillars: string[];
  setSelectedPillars: (value: string[]) => void;
  selectedRegions: Region[];
  setSelectedRegions: (value: Region[]) => void;
  selectedCriticalities: string[];
  setSelectedCriticalities: (value: string[]) => void;
  selectedDispositions: string[];
  setSelectedDispositions: (value: string[]) => void;
  selectedPrimaryStakeholders: string[];
  setSelectedPrimaryStakeholders: (value: string[]) => void;
  selectedImpactedStakeholders: string[];
  setSelectedImpactedStakeholders: (value: string[]) => void;
  selectedGroupBy:
    | 'pillar'
    | 'stakeholder'
    | 'criticality'
    | 'region'
    | 'disposition';
  setSelectedGroupBy: (
    value: 'pillar' | 'stakeholder' | 'criticality' | 'region' | 'disposition',
  ) => void;
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
    showDynamicHeader: boolean;
    darkMode: boolean;
  };
  setDisplayOptions: (value: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
    itemVerticalPadding: number;
    laneDividerOpacity: number;
    itemStyle: 'tile' | 'line';
    lineTitleGap: number;
    showQuarters: boolean;
    showMonths: boolean;
    showDynamicHeader: boolean;
    darkMode: boolean;
  }) => void;
  selectedTheme:
    | 'coastal'
    | 'orchard'
    | 'sunset'
    | 'sand'
    | 'mono'
    | 'forest'
    | 'metro'
    | 'metro-dark'
    | 'executive';
  setSelectedTheme: (
    value:
      | 'coastal'
      | 'orchard'
      | 'sunset'
      | 'sand'
      | 'mono'
      | 'forest'
      | 'metro'
      | 'metro-dark'
      | 'executive',
  ) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  quartersToShow: number;
  setQuartersToShow: (value: number) => void;
  viewMode: 'planned' | 'unplanned';
  savedViewsPanel?: React.ReactNode;
  showDebugOutlines?: boolean;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function RoadmapFilters({
  items,
  selectedPillars,
  setSelectedPillars,
  selectedRegions,
  setSelectedRegions,
  selectedCriticalities,
  setSelectedCriticalities,
  selectedDispositions,
  setSelectedDispositions,
  selectedPrimaryStakeholders,
  setSelectedPrimaryStakeholders,
  selectedImpactedStakeholders,
  setSelectedImpactedStakeholders,
  selectedGroupBy,
  setSelectedGroupBy,
  displayOptions,
  setDisplayOptions,
  selectedTheme,
  setSelectedTheme,
  startDate,
  setStartDate,
  quartersToShow,
  setQuartersToShow,
  viewMode,
  savedViewsPanel,
  showDebugOutlines = false,
  isCollapsed = false,
  onToggleCollapsed,
}: Props) {
  const isUnplanned = viewMode === 'unplanned';
  const pillars = uniqueNormalizedOptions(items.map((i) => i.pillar));
  const regions: Region[] = ['US', 'Canada'];
  const criticalities = uniqueNormalizedOptions(
    items.map((i) => i.criticality),
  );
  const dispositions = uniqueNormalizedOptions(items.map((i) => i.disposition));
  const primaryStakeholders = uniqueNormalizedOptions(
    items.map((i) => i.executiveSponsor),
  );
  const impactedStakeholders = uniqueNormalizedOptions(
    items.flatMap((item) => parseStakeholders(item.impactedStakeholders)),
  );

  const clearFilters = () => {
    setSelectedPillars([]);
    setSelectedRegions([]);
    setSelectedCriticalities([]);
    setSelectedDispositions([]);
    setSelectedPrimaryStakeholders([]);
    setSelectedImpactedStakeholders([]);
  };

  const compactSelectClasses =
    'border border-slate-300 rounded-md px-2 py-1 text-sm bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200';

  const getSelectedOptions = (event: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(event.target.selectedOptions, (option) => option.value);

  const checkboxClasses =
    'h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-500 dark:bg-slate-900 dark:text-sky-400 dark:focus:ring-sky-400';
  const toggleValue = (list: string[], value: string) =>
    list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value];

  const renderCheckboxDropdown = (
    label: string,
    options: string[],
    selected: string[],
    onChange: (next: string[]) => void,
    placeholder: string,
    countLabels: { singular: string; plural: string },
  ) => (
    <div className="space-y-1">
      <details className="rounded-md border border-slate-200 bg-white text-xs dark:border-slate-600 dark:bg-slate-900">
        <summary
          className="cursor-pointer list-none px-2 py-1 text-slate-700 dark:text-slate-200"
          aria-label={label}
        >
          {selected.length > 0
            ? `${selected.length} ${
                selected.length === 1
                  ? countLabels.singular
                  : countLabels.plural
              } selected`
            : placeholder}
        </summary>
        <div className="border-t border-slate-200 px-2 py-2 space-y-2 dark:border-slate-700">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 text-slate-700 dark:text-slate-200"
            >
              <input
                type="checkbox"
                className={checkboxClasses}
                checked={selected.includes(option)}
                onChange={() => onChange(toggleValue(selected, option))}
              />
              {option}
            </label>
          ))}
        </div>
      </details>
    </div>
  );

  const renderSelectedChips = (
    values: string[],
    onRemove: (value: string) => void,
  ) =>
    values.length > 0 ? (
      <div className="flex flex-wrap gap-2 pt-0">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onRemove(value)}
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <span>{value}</span>
            <span className="text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
              ×
            </span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <section
      className={[
        'space-y-4',
        showDebugOutlines
          ? 'outline outline-1 outline-dashed outline-fuchsia-300/80'
          : '',
      ].join(' ')}
    >
      <div className="relative rounded-xl border border-slate-200 bg-white p-0 dark:border-slate-700 dark:bg-slate-900">
        {showDebugOutlines ? (
          <span className="absolute -top-3 left-2 rounded bg-fuchsia-100 px-1 text-[10px] font-semibold text-fuchsia-800">
            SETTINGS PANEL
          </span>
        ) : null}
        <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200 dark:border-slate-700 dark:text-slate-300">
          <span className={isCollapsed ? 'sr-only' : ''}>SETTINGS</span>
          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              title={isCollapsed ? 'Expand controls' : 'Collapse controls'}
              aria-label={isCollapsed ? 'Expand controls' : 'Collapse controls'}
            >
              {isCollapsed ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 6l6 6-6 6" />
                  <path d="M14 6l6 6-6 6" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 6l-6 6 6 6" />
                  <path d="M10 6l-6 6 6 6" />
                </svg>
              )}
            </button>
          ) : null}
        </div>
        {isCollapsed ? null : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            <div className="space-y-3 px-3 pt-2 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  View by
                </div>
                <select
                  className={compactSelectClasses}
                  value={selectedGroupBy}
                  onChange={(e) =>
                    setSelectedGroupBy(
                      e.target.value as
                        | 'pillar'
                        | 'stakeholder'
                        | 'criticality'
                        | 'region'
                        | 'disposition',
                    )
                  }
                >
                  <option value="pillar">Pillar</option>
                  <option value="stakeholder">Primary stakeholder</option>
                  <option value="criticality">Criticality</option>
                  <option value="region">Region</option>
                  <option value="disposition">Disposition</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Filters
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear filters
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {renderCheckboxDropdown(
                  'Pillar',
                  pillars,
                  selectedPillars,
                  setSelectedPillars,
                  'Select pillar',
                  { singular: 'pillar', plural: 'pillars' },
                )}
                {renderSelectedChips(selectedPillars, (value) =>
                  setSelectedPillars(
                    selectedPillars.filter((item) => item !== value),
                  ),
                )}

                {renderCheckboxDropdown(
                  'Region',
                  regions,
                  selectedRegions,
                  (next) => setSelectedRegions(next as Region[]),
                  'Select region',
                  { singular: 'region', plural: 'regions' },
                )}
                {renderSelectedChips(selectedRegions, (value) =>
                  setSelectedRegions(
                    selectedRegions.filter((item) => item !== value),
                  ),
                )}

                {renderCheckboxDropdown(
                  'Criticality',
                  criticalities,
                  selectedCriticalities,
                  setSelectedCriticalities,
                  'Select criticality',
                  { singular: 'criticality', plural: 'criticalities' },
                )}
                {renderSelectedChips(selectedCriticalities, (value) =>
                  setSelectedCriticalities(
                    selectedCriticalities.filter((item) => item !== value),
                  ),
                )}

                {renderCheckboxDropdown(
                  'Disposition',
                  dispositions,
                  selectedDispositions,
                  setSelectedDispositions,
                  'Select disposition',
                  { singular: 'disposition', plural: 'dispositions' },
                )}
                {renderSelectedChips(selectedDispositions, (value) =>
                  setSelectedDispositions(
                    selectedDispositions.filter((item) => item !== value),
                  ),
                )}

                {renderCheckboxDropdown(
                  'Primary stakeholder',
                  primaryStakeholders,
                  selectedPrimaryStakeholders,
                  setSelectedPrimaryStakeholders,
                  'Select primary stakeholder',
                  { singular: 'primary stakeholder', plural: 'primary stakeholders' },
                )}
                {renderSelectedChips(selectedPrimaryStakeholders, (value) =>
                  setSelectedPrimaryStakeholders(
                    selectedPrimaryStakeholders.filter((item) => item !== value),
                  ),
                )}

                {renderCheckboxDropdown(
                  'Impacted stakeholders',
                  impactedStakeholders,
                  selectedImpactedStakeholders,
                  setSelectedImpactedStakeholders,
                  'Select stakeholders',
                  { singular: 'impacted stakeholder', plural: 'impacted stakeholders' },
                )}
                {renderSelectedChips(selectedImpactedStakeholders, (value) =>
                  setSelectedImpactedStakeholders(
                    selectedImpactedStakeholders.filter((item) => item !== value),
                  ),
                )}
              </div>
            </div>

            {savedViewsPanel ? (
              <div className="px-3 py-3">{savedViewsPanel}</div>
            ) : null}

            {!isUnplanned ? (
              <div className="space-y-3 px-3 py-3">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Board options
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        className={checkboxClasses}
                        checked={displayOptions.showDynamicHeader}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            showDynamicHeader: e.target.checked,
                          })
                        }
                      />
                      Show title
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Theme
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        className={compactSelectClasses}
                        value={selectedTheme}
                        onChange={(e) =>
                          setSelectedTheme(
                            e.target.value as
                              | 'coastal'
                              | 'orchard'
                              | 'sunset'
                              | 'sand'
                              | 'mono'
                              | 'forest'
                              | 'metro'
                              | 'metro-dark'
                              | 'executive',
                          )
                        }
                      >
                        <option value="executive">Executive</option>
                        <option value="coastal">Coastal</option>
                        <option value="orchard">Orchard</option>
                        <option value="sunset">Sunset</option>
                        <option value="sand">Sand</option>
                        <option value="mono">Mono</option>
                        <option value="forest">Forest</option>
                        <option value="metro">Metro</option>
                        <option value="metro-dark">Metro Dark</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          className={checkboxClasses}
                          checked={displayOptions.darkMode}
                          onChange={(e) =>
                            setDisplayOptions({
                              ...displayOptions,
                              darkMode: e.target.checked,
                            })
                          }
                        />
                        Dark mode
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">
                        Start date
                      </label>
                      <input
                        type="date"
                        className={compactSelectClasses}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">
                        Quarters shown
                      </label>
                      <select
                        className={compactSelectClasses}
                        value={quartersToShow}
                        onChange={(e) => setQuartersToShow(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, index) => {
                          const count = index + 1;
                          return (
                            <option key={count} value={count}>
                              {count}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        className={checkboxClasses}
                        checked={displayOptions.showQuarters}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            showQuarters: e.target.checked,
                          })
                        }
                      />
                      Show quarters
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        className={checkboxClasses}
                        checked={displayOptions.showMonths}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            showMonths: e.target.checked,
                          })
                        }
                      />
                      Show months
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Item spacing
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={16}
                        step={1}
                        value={displayOptions.itemVerticalPadding}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            itemVerticalPadding: Number(e.target.value),
                          })
                        }
                        className="w-28"
                      />
                      <input
                        type="number"
                        min={0}
                        max={16}
                        step={1}
                        value={displayOptions.itemVerticalPadding}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            itemVerticalPadding: Number(e.target.value),
                          })
                        }
                        className="w-14 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <span className="text-[0.7rem] text-slate-500 dark:text-slate-400">px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Lane divider darkness
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={0.4}
                        step={0.02}
                        value={displayOptions.laneDividerOpacity}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            laneDividerOpacity: Number(e.target.value),
                          })
                        }
                        className="w-28"
                      />
                      <input
                        type="number"
                        min={0}
                        max={0.4}
                        step={0.02}
                        value={displayOptions.laneDividerOpacity}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            laneDividerOpacity: Number(e.target.value),
                          })
                        }
                        className="w-14 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 px-3 py-3">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Item options
              </div>
              <div className="space-y-3">
                {!isUnplanned ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2 dark:text-slate-300">
                      Item style
                    </label>
                    <div className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="item-style"
                          value="tile"
                          checked={displayOptions.itemStyle === 'tile'}
                          onChange={() =>
                            setDisplayOptions({
                              ...displayOptions,
                              itemStyle: 'tile',
                            })
                          }
                        />
                        Tile
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="item-style"
                          value="line"
                          checked={displayOptions.itemStyle === 'line'}
                          onChange={() =>
                            setDisplayOptions({
                              ...displayOptions,
                              itemStyle: 'line',
                            })
                          }
                        />
                        Line
                      </label>
                    </div>
                  </div>
                ) : null}
                {!isUnplanned && displayOptions.itemStyle === 'line' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">
                      Line title gap
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={12}
                        step={1}
                        value={displayOptions.lineTitleGap}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            lineTitleGap: Number(e.target.value),
                          })
                        }
                        className="w-28"
                      />
                      <input
                        type="number"
                        min={0}
                        max={12}
                        step={1}
                        value={displayOptions.lineTitleGap}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            lineTitleGap: Number(e.target.value),
                          })
                        }
                        className="w-14 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <span className="text-[0.7rem] text-slate-500 dark:text-slate-400">px</span>
                    </div>
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className={checkboxClasses}
                    checked={displayOptions.showRegionEmojis}
                    onChange={(e) =>
                      setDisplayOptions({
                        ...displayOptions,
                        showRegionEmojis: e.target.checked,
                      })
                    }
                  />
                  Show region flags
                </label>
                {!isUnplanned ? (
                  <>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        className={checkboxClasses}
                        checked={displayOptions.showShortDescription}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            showShortDescription: e.target.checked,
                          })
                        }
                      />
                      Show short description
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        className={checkboxClasses}
                        checked={displayOptions.titleAbove}
                        onChange={(e) =>
                          setDisplayOptions({
                            ...displayOptions,
                            titleAbove: e.target.checked,
                          })
                        }
                      />
                      Title above item
                    </label>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueNormalizedOptions(values: Array<string | undefined | null>): string[] {
  const map = new Map<string, string>();
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalizeFilterValue(trimmed);
    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}
