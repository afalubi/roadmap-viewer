'use client';

import { useEffect, useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { loadRoadmap } from '@/lib/loadRoadmap';
import { parseRegions, type Region } from '@/lib/region';
import { getQuarterStartDate } from '@/lib/timeScale';
import { parseStakeholders } from '@/lib/stakeholders';
import { RoadmapFilters } from '@/components/roadmap/RoadmapFilters';
import { RoadmapTimeline } from '@/components/roadmap/RoadmapTimeline';

export default function HomePage() {
  const settingsKey = 'roadmap-viewer-settings';
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RoadmapItem[]>([]);
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [selectedCriticalities, setSelectedCriticalities] = useState<string[]>(
    [],
  );
  const [selectedImpactedStakeholders, setSelectedImpactedStakeholders] =
    useState<string[]>([]);
  const [selectedGroupBy, setSelectedGroupBy] = useState<
    'pillar' | 'stakeholder' | 'criticality' | 'region'
  >('pillar');
  const [displayOptions, setDisplayOptions] = useState({
    showRegionEmojis: true,
    showShortDescription: true,
    titleAbove: false,
    itemVerticalPadding: 6,
    laneDividerOpacity: 0.12,
    itemStyle: 'tile' as 'tile' | 'line',
    lineTitleGap: 2,
  });
  const [selectedTheme, setSelectedTheme] = useState<
    | 'coastal'
    | 'orchard'
    | 'sunset'
    | 'slate'
    | 'sand'
    | 'mist'
    | 'mono'
    | 'forest'
    | 'metro'
    | 'metro-dark'
  >('coastal');
  const [startDate, setStartDate] = useState(() =>
    formatDateInput(getQuarterStartDate(new Date())),
  );
  const [quartersToShow, setQuartersToShow] = useState(5);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    loadRoadmap().then((data) => {
      setItems(data);
      setFilteredItems(data);
    });
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(settingsKey);
    if (!raw) {
      setIsHydrated(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<{
        selectedPillars: string[];
        selectedRegions: Region[];
        selectedCriticalities: string[];
        selectedImpactedStakeholders: string[];
        selectedGroupBy: 'pillar' | 'stakeholder' | 'criticality' | 'region';
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
        displayOptions: {
          showRegionEmojis: boolean;
          showShortDescription: boolean;
          titleAbove: boolean;
          itemVerticalPadding: number;
          laneDividerOpacity: number;
          itemStyle: 'tile' | 'line';
          lineTitleGap: number;
        };
        startDate: string;
        quartersToShow: number;
      }>;

      if (parsed.selectedPillars) setSelectedPillars(parsed.selectedPillars);
      if (parsed.selectedRegions) setSelectedRegions(parsed.selectedRegions);
      if (parsed.selectedCriticalities)
        setSelectedCriticalities(parsed.selectedCriticalities);
      if (parsed.selectedImpactedStakeholders)
        setSelectedImpactedStakeholders(parsed.selectedImpactedStakeholders);
      if (parsed.selectedGroupBy) setSelectedGroupBy(parsed.selectedGroupBy);
      if (parsed.selectedTheme) setSelectedTheme(parsed.selectedTheme);
      if (parsed.displayOptions) setDisplayOptions(parsed.displayOptions);
      if (parsed.startDate) setStartDate(parsed.startDate);
      if (parsed.quartersToShow) setQuartersToShow(parsed.quartersToShow);
    } catch {
      // Ignore corrupted storage entries.
    } finally {
      setIsHydrated(true);
    }
  }, [settingsKey]);

  useEffect(() => {
    if (!isHydrated) return;
    const payload = {
      selectedPillars,
      selectedRegions,
      selectedCriticalities,
      selectedImpactedStakeholders,
      selectedGroupBy,
      selectedTheme,
      displayOptions,
      startDate,
      quartersToShow,
    };
    localStorage.setItem(settingsKey, JSON.stringify(payload));
  }, [
    isHydrated,
    selectedPillars,
    selectedRegions,
    selectedCriticalities,
    selectedImpactedStakeholders,
    selectedGroupBy,
    selectedTheme,
    displayOptions,
    startDate,
    quartersToShow,
    settingsKey,
  ]);

  useEffect(() => {
    let result = [...items];
    if (selectedPillars.length > 0) {
      result = result.filter((i) => selectedPillars.includes(i.pillar));
    }
    if (selectedRegions.length > 0) {
      result = result.filter((i) => {
        const regions = parseRegions(i.region);
        return selectedRegions.some((region) => regions.includes(region));
      });
    }
    if (selectedCriticalities.length > 0) {
      result = result.filter((i) =>
        selectedCriticalities.includes(i.criticality),
      );
    }
    if (selectedImpactedStakeholders.length > 0) {
      result = result.filter((i) => {
        const stakeholders = parseStakeholders(i.impactedStakeholders);
        return selectedImpactedStakeholders.some((stakeholder) =>
          stakeholders.includes(stakeholder),
        );
      });
    }
    setFilteredItems(result);
  }, [
    items,
    selectedPillars,
    selectedRegions,
    selectedCriticalities,
    selectedImpactedStakeholders,
  ]);

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Technology Roadmap
          </h1>
          <p className="text-sm text-slate-600">
            Visualize roadmap ideas across pillars, time, and regions.
          </p>
        </header>

        <RoadmapFilters
          items={items}
          selectedPillars={selectedPillars}
          setSelectedPillars={setSelectedPillars}
          selectedRegions={selectedRegions}
          setSelectedRegions={setSelectedRegions}
          selectedCriticalities={selectedCriticalities}
          setSelectedCriticalities={setSelectedCriticalities}
          selectedImpactedStakeholders={selectedImpactedStakeholders}
          setSelectedImpactedStakeholders={setSelectedImpactedStakeholders}
          selectedGroupBy={selectedGroupBy}
          setSelectedGroupBy={setSelectedGroupBy}
          displayOptions={displayOptions}
          setDisplayOptions={setDisplayOptions}
          selectedTheme={selectedTheme}
          setSelectedTheme={setSelectedTheme}
          startDate={startDate}
          setStartDate={setStartDate}
          quartersToShow={quartersToShow}
          setQuartersToShow={setQuartersToShow}
        />

        <RoadmapTimeline
          items={filteredItems}
          groupBy={selectedGroupBy}
          displayOptions={displayOptions}
          theme={selectedTheme}
          startDate={startDate}
          quartersToShow={quartersToShow}
        />
      </div>
    </main>
  );
}

function formatDateInput(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
