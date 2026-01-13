'use client';

import { useState } from 'react';
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
  selectedImpactedStakeholders: string[];
  setSelectedImpactedStakeholders: (value: string[]) => void;
  selectedGroupBy: 'pillar' | 'stakeholder' | 'criticality' | 'region';
  setSelectedGroupBy: (
    value: 'pillar' | 'stakeholder' | 'criticality' | 'region',
  ) => void;
  displayOptions: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
    itemVerticalPadding: number;
    laneDividerOpacity: number;
    itemStyle: 'tile' | 'line';
    lineTitleGap: number;
  };
  setDisplayOptions: (value: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
    itemVerticalPadding: number;
    laneDividerOpacity: number;
    itemStyle: 'tile' | 'line';
    lineTitleGap: number;
  }) => void;
  selectedTheme:
    | 'coastal'
    | 'orchard'
    | 'sunset'
    | 'slate'
    | 'sand'
    | 'mist'
    | 'mono'
    | 'forest'
    | 'metro'
    | 'metro-dark';
  setSelectedTheme: (
    value:
      | 'coastal'
      | 'orchard'
      | 'sunset'
      | 'slate'
      | 'sand'
      | 'mist'
      | 'mono'
      | 'forest'
      | 'metro'
      | 'metro-dark',
  ) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  quartersToShow: number;
  setQuartersToShow: (value: number) => void;
  onCsvUpload: (text: string) => void;
  onCsvDownload: () => void;
  isHeaderCollapsed: boolean;
  setIsHeaderCollapsed: (value: boolean) => void;
}

export function RoadmapFilters({
  items,
  selectedPillars,
  setSelectedPillars,
  selectedRegions,
  setSelectedRegions,
  selectedCriticalities,
  setSelectedCriticalities,
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
  onCsvUpload,
  onCsvDownload,
  isHeaderCollapsed,
  setIsHeaderCollapsed,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const pillars = Array.from(
    new Set(items.map((i) => i.pillar).filter(Boolean)),
  ).sort();
  const regions: Region[] = ['US', 'Canada'];
  const criticalities = Array.from(
    new Set(items.map((i) => i.criticality).filter(Boolean)),
  ).sort();
  const impactedStakeholders = Array.from(
    new Set(
      items.flatMap((item) => parseStakeholders(item.impactedStakeholders)),
    ),
  ).sort();

  const clearFilters = () => {
    setSelectedPillars([]);
    setSelectedRegions([]);
    setSelectedCriticalities([]);
    setSelectedImpactedStakeholders([]);
  };

  const compactSelectClasses =
    'border border-slate-300 rounded-md px-2 py-1 text-sm bg-white';

  const getSelectedOptions = (event: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(event.target.selectedOptions, (option) => option.value);

  const checkboxClasses =
    'h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500';
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
  ) => (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <details className="rounded-md border border-slate-200 bg-white text-xs">
        <summary className="cursor-pointer list-none px-2 py-1 text-slate-700">
          {selected.length > 0 ? `${selected.length} selected` : placeholder}
        </summary>
        <div className="border-t border-slate-200 px-2 py-2 space-y-2">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 text-slate-700"
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

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    onCsvUpload(text);
  };

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const chips = [
    ...selectedPillars.map((value) => ({
      key: `pillar-${value}`,
      label: `Pillar: ${value}`,
      onRemove: () =>
        setSelectedPillars(selectedPillars.filter((item) => item !== value)),
    })),
    ...selectedRegions.map((value) => ({
      key: `region-${value}`,
      label: `Region: ${value}`,
      onRemove: () =>
        setSelectedRegions(selectedRegions.filter((item) => item !== value)),
    })),
    ...selectedCriticalities.map((value) => ({
      key: `criticality-${value}`,
      label: `Criticality: ${value}`,
      onRemove: () =>
        setSelectedCriticalities(
          selectedCriticalities.filter((item) => item !== value),
        ),
    })),
    ...selectedImpactedStakeholders.map((value) => ({
      key: `stakeholder-${value}`,
      label: `Stakeholder: ${value}`,
      onRemove: () =>
        setSelectedImpactedStakeholders(
          selectedImpactedStakeholders.filter((item) => item !== value),
        ),
    })),
  ];

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            View by
          </label>
          <select
            className={compactSelectClasses}
            value={selectedGroupBy}
            onChange={(e) =>
              setSelectedGroupBy(
                e.target.value as
                  | 'pillar'
                  | 'stakeholder'
                  | 'criticality'
                  | 'region',
              )
            }
          >
            <option value="pillar">Pillar</option>
            <option value="stakeholder">Primary stakeholder</option>
            <option value="criticality">Criticality</option>
            <option value="region">Region</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onRemove}
                  className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                >
                  <span>{chip.label}</span>
                  <span className="text-slate-400 group-hover:text-slate-600">
                    ×
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <label
            className={[
              'relative flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-slate-700',
              isDragging
                ? 'border-sky-400 bg-sky-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <span>Upload CSV</span>
            <span className="text-slate-400">or drop</span>
          </label>
          <button
            type="button"
            onClick={onCsvDownload}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Download CSV
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
          className="text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          {isHeaderCollapsed ? 'Show options' : 'Hide options'}
        </button>
      </div>

      {isHeaderCollapsed ? null : (
        <div className="grid gap-6 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filters
          </div>
          <div className="flex flex-wrap gap-4 items-start rounded-lg bg-slate-50/70 p-3 border border-slate-200">
            {renderCheckboxDropdown(
              'Pillar',
              pillars,
              selectedPillars,
              setSelectedPillars,
              'Select pillar',
            )}

            {renderCheckboxDropdown(
              'Region',
              regions,
              selectedRegions,
              (next) => setSelectedRegions(next as Region[]),
              'Select region',
            )}

            {renderCheckboxDropdown(
              'Criticality',
              criticalities,
              selectedCriticalities,
              setSelectedCriticalities,
              'Select criticality',
            )}

            {renderCheckboxDropdown(
              'Impacted stakeholders',
              impactedStakeholders,
              selectedImpactedStakeholders,
              setSelectedImpactedStakeholders,
              'Select stakeholders',
            )}

            <button
              type="button"
              onClick={clearFilters}
              className="self-end text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="space-y-3 border-l border-slate-200 pl-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Board display options
          </div>
          <div className="space-y-3 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Theme
              </label>
              <select
                className={compactSelectClasses}
                value={selectedTheme}
                onChange={(e) =>
                  setSelectedTheme(
                    e.target.value as
                      | 'coastal'
                      | 'orchard'
                      | 'sunset'
                      | 'slate'
                      | 'sand'
                      | 'mist'
                      | 'mono'
                      | 'forest'
                      | 'metro'
                      | 'metro-dark',
                  )
                }
              >
                <option value="coastal">Coastal</option>
                <option value="orchard">Orchard</option>
                <option value="sunset">Sunset</option>
                <option value="slate">Slate</option>
                <option value="sand">Sand</option>
                <option value="mist">Mist</option>
                <option value="mono">Mono</option>
                <option value="forest">Forest</option>
                <option value="metro">Metro</option>
                <option value="metro-dark">Metro Dark</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
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
                <label className="block text-xs font-medium text-slate-600 mb-1">
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
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
                  className="w-14 rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
                <span className="text-[0.7rem] text-slate-500">px</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
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
                  className="w-14 rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-l border-slate-200 pl-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Item display options
          </div>
          <div className="space-y-3 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Item style
              </label>
              <div className="flex items-center gap-3 text-xs text-slate-700">
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
            {displayOptions.itemStyle === 'line' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
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
                    className="w-14 rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <span className="text-[0.7rem] text-slate-500">px</span>
                </div>
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-xs text-slate-700">
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
            <label className="flex items-center gap-2 text-xs text-slate-700">
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
            <label className="flex items-center gap-2 text-xs text-slate-700">
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
          </div>
        </div>
      </div>
      )}
    </section>
  );
}
