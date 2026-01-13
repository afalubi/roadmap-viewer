'use client';

import { useEffect, useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { loadRoadmap } from '@/lib/loadRoadmap';
import { parseRegions } from '@/lib/region';
import { parseStakeholders } from '@/lib/stakeholders';
import { RoadmapFilters } from '@/components/roadmap/RoadmapFilters';
import { RoadmapTimeline } from '@/components/roadmap/RoadmapTimeline';

export default function HomePage() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RoadmapItem[]>([]);
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCriticalities, setSelectedCriticalities] = useState<string[]>(
    [],
  );
  const [selectedImpactedStakeholders, setSelectedImpactedStakeholders] =
    useState<string[]>([]);
  const [selectedGroupBy, setSelectedGroupBy] = useState<
    'pillar' | 'stakeholder' | 'criticality'
  >('pillar');
  const [displayOptions, setDisplayOptions] = useState({
    showRegionEmojis: true,
    showShortDescription: true,
    titleAbove: false,
  });
  const [selectedTheme, setSelectedTheme] = useState<
    'coastal' | 'orchard' | 'sunset'
  >('coastal');
  const [quartersToShow, setQuartersToShow] = useState(5);

  useEffect(() => {
    loadRoadmap().then((data) => {
      setItems(data);
      setFilteredItems(data);
    });
  }, []);

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
          quartersToShow={quartersToShow}
          setQuartersToShow={setQuartersToShow}
        />

        <RoadmapTimeline
          items={filteredItems}
          groupBy={selectedGroupBy}
          displayOptions={displayOptions}
          theme={selectedTheme}
          quartersToShow={quartersToShow}
        />
      </div>
    </main>
  );
}
