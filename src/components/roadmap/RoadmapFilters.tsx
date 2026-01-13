'use client';

import type React from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { parseStakeholders } from '@/lib/stakeholders';

interface Props {
  items: RoadmapItem[];
  selectedPillars: string[];
  setSelectedPillars: (value: string[]) => void;
  selectedRegions: string[];
  setSelectedRegions: (value: string[]) => void;
  selectedCriticalities: string[];
  setSelectedCriticalities: (value: string[]) => void;
  selectedImpactedStakeholders: string[];
  setSelectedImpactedStakeholders: (value: string[]) => void;
  selectedGroupBy: 'pillar' | 'stakeholder' | 'criticality';
  setSelectedGroupBy: (value: 'pillar' | 'stakeholder' | 'criticality') => void;
  displayOptions: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
  };
  setDisplayOptions: (value: {
    showRegionEmojis: boolean;
    showShortDescription: boolean;
    titleAbove: boolean;
  }) => void;
  selectedTheme: 'coastal' | 'orchard' | 'sunset';
  setSelectedTheme: (value: 'coastal' | 'orchard' | 'sunset') => void;
  quartersToShow: number;
  setQuartersToShow: (value: number) => void;
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
  quartersToShow,
  setQuartersToShow,
}: Props) {
  const pillars = Array.from(
    new Set(items.map((i) => i.pillar).filter(Boolean)),
  ).sort();
  const regions = ['US', 'Canada'];
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

  const selectClasses =
    'border border-slate-300 rounded-md px-2 py-1 text-sm bg-white min-h-[5.5rem]';

  const getSelectedOptions = (event: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(event.target.selectedOptions, (option) => option.value);

  const checkboxClasses =
    'h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500';

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            View by
          </label>
          <select
            className={selectClasses}
            value={selectedGroupBy}
            onChange={(e) =>
              setSelectedGroupBy(
                e.target.value as 'pillar' | 'stakeholder' | 'criticality',
              )
            }
          >
            <option value="pillar">Pillar</option>
            <option value="stakeholder">Primary stakeholder</option>
            <option value="criticality">Criticality</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Pillar
          </label>
          <select
            className={selectClasses}
            multiple
            value={selectedPillars}
            onChange={(e) => setSelectedPillars(getSelectedOptions(e))}
          >
            {pillars.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Region
          </label>
          <select
            className={selectClasses}
            multiple
            value={selectedRegions}
            onChange={(e) => setSelectedRegions(getSelectedOptions(e))}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Criticality
          </label>
          <select
            className={selectClasses}
            multiple
            value={selectedCriticalities}
            onChange={(e) => setSelectedCriticalities(getSelectedOptions(e))}
          >
            {criticalities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Impacted stakeholders
          </label>
          <select
            className={selectClasses}
            multiple
            value={selectedImpactedStakeholders}
            onChange={(e) =>
              setSelectedImpactedStakeholders(getSelectedOptions(e))
            }
          >
            {impactedStakeholders.map((stakeholder) => (
              <option key={stakeholder} value={stakeholder}>
                {stakeholder}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-600">
            Display options
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Theme
            </label>
            <select
              className="border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
              value={selectedTheme}
              onChange={(e) =>
                setSelectedTheme(
                  e.target.value as 'coastal' | 'orchard' | 'sunset',
                )
              }
            >
              <option value="coastal">Coastal</option>
              <option value="orchard">Orchard</option>
              <option value="sunset">Sunset</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Quarters shown
            </label>
            <select
              className="border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
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

        <button
          type="button"
          onClick={clearFilters}
          className="ml-auto text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
