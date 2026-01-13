'use client';

import { useEffect, useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { loadRoadmap } from '@/lib/loadRoadmap';
import { parseRegions, type Region } from '@/lib/region';
import { getQuarterStartDate } from '@/lib/timeScale';
import { parseStakeholders } from '@/lib/stakeholders';
import { parseRoadmapCsv } from '@/lib/loadRoadmapFromCsv';
import { RoadmapFilters } from '@/components/roadmap/RoadmapFilters';
import { RoadmapTimeline } from '@/components/roadmap/RoadmapTimeline';

export default function HomePage() {
  const settingsKey = 'roadmap-viewer-settings';
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RoadmapItem[]>([]);
  const [currentCsvText, setCurrentCsvText] = useState('');
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
    showQuarters: true,
    showMonths: false,
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
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);

  useEffect(() => {
    loadRoadmap().then((data) => {
      setItems(data);
      setFilteredItems(data);
    });
    fetch('/data/roadmap.csv')
      .then((res) => res.text())
      .then((text) => setCurrentCsvText(text))
      .catch(() => {
        setCurrentCsvText('');
      });
  }, []);

  const handleCsvDownload = () => {
    const csv = currentCsvText || buildCsvFromItems(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roadmap.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvUploadText = (text: string) => {
    const parsedItems = parseRoadmapCsv(text);
    setItems(parsedItems);
    setFilteredItems(parsedItems);
    setSelectedPillars([]);
    setSelectedRegions([]);
    setSelectedCriticalities([]);
    setSelectedImpactedStakeholders([]);
    setCurrentCsvText(text);
  };

  const handleCsvFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    handleCsvUploadText(text);
  };

  const handleCsvDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDraggingCsv(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleCsvFile(file);
    }
  };

  const handleExportImage = async () => {
    setIsExporting(true);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const exportNode = document.getElementById('roadmap-export');
    if (!exportNode) {
      setIsExporting(false);
      return;
    }
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(exportNode, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'roadmap.png';
    link.click();
    setIsExporting(false);
  };

  const summaryViewBy = {
    pillar: 'Pillar',
    stakeholder: 'Primary stakeholder',
    criticality: 'Criticality',
    region: 'Region',
  }[selectedGroupBy];

  const appliedFilters = [
    selectedPillars.length
      ? `Pillars: ${selectedPillars.join(', ')}`
      : null,
    selectedRegions.length
      ? `Regions: ${selectedRegions.join(', ')}`
      : null,
    selectedCriticalities.length
      ? `Criticality: ${selectedCriticalities.join(', ')}`
      : null,
    selectedImpactedStakeholders.length
      ? `Stakeholders: ${selectedImpactedStakeholders.join(', ')}`
      : null,
  ].filter(Boolean) as string[];

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
        isHeaderCollapsed: boolean;
      }>;

      if (parsed.selectedPillars) setSelectedPillars(parsed.selectedPillars);
      if (parsed.selectedRegions) setSelectedRegions(parsed.selectedRegions);
      if (parsed.selectedCriticalities)
        setSelectedCriticalities(parsed.selectedCriticalities);
      if (parsed.selectedImpactedStakeholders)
        setSelectedImpactedStakeholders(parsed.selectedImpactedStakeholders);
      if (parsed.selectedGroupBy) setSelectedGroupBy(parsed.selectedGroupBy);
      if (parsed.selectedTheme) setSelectedTheme(parsed.selectedTheme);
      if (parsed.displayOptions) {
        setDisplayOptions((current) => ({
          ...current,
          ...parsed.displayOptions,
        }));
      }
      if (parsed.startDate) setStartDate(parsed.startDate);
      if (parsed.quartersToShow) setQuartersToShow(parsed.quartersToShow);
      if (typeof parsed.isHeaderCollapsed === 'boolean') {
        setIsHeaderCollapsed(parsed.isHeaderCollapsed);
      }
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
      isHeaderCollapsed,
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
    isHeaderCollapsed,
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

        <div className="flex flex-wrap items-center gap-3">
          <label
            className={[
              'relative flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-slate-700',
              isDraggingCsv
                ? 'border-sky-400 bg-sky-50'
                : 'border-slate-200 bg-white hover:border-slate-300',
            ].join(' ')}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingCsv(true);
            }}
            onDragLeave={() => setIsDraggingCsv(false)}
            onDrop={handleCsvDrop}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => handleCsvFile(event.target.files?.[0])}
            />
            <span>Upload CSV</span>
            <span className="text-slate-400">or drop</span>
          </label>
          <button
            type="button"
            onClick={handleCsvDownload}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            Download CSV
          </button>
          <button
            type="button"
            onClick={handleExportImage}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export Image'}
          </button>
        </div>

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
          isHeaderCollapsed={isHeaderCollapsed}
          setIsHeaderCollapsed={setIsHeaderCollapsed}
        />

        <RoadmapTimeline
          items={filteredItems}
          groupBy={selectedGroupBy}
          displayOptions={displayOptions}
          theme={selectedTheme}
          startDate={startDate}
          quartersToShow={quartersToShow}
          exportSummary={{
            viewBy: summaryViewBy,
            filters: appliedFilters,
          }}
          isExporting={isExporting}
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

function buildCsvFromItems(items: RoadmapItem[]): string {
  const headers = [
    'id',
    'title',
    'url',
    'impactedStakeholders',
    'submitterName',
    'submitterDepartment',
    'submitterPriority',
    'shortDescription',
    'longDescription',
    'criticality',
    'executiveSponsor',
    'startDate',
    'endDate',
    'tShirtSize',
    'pillar',
    'region',
    'expenseType',
    'pointOfContact',
    'lead',
  ];
  const escapeValue = (value: string) => {
    const safe = value ?? '';
    if (/[",\n]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };
  const rows = items.map((item) =>
    [
      item.id,
      item.title,
      item.url,
      item.impactedStakeholders,
      item.submitterName,
      item.submitterDepartment,
      item.submitterPriority,
      item.shortDescription,
      item.longDescription,
      item.criticality,
      item.executiveSponsor,
      item.startDate,
      item.endDate,
      item.tShirtSize,
      item.pillar,
      item.region,
      item.expenseType,
      item.pointOfContact,
      item.lead,
    ]
      .map(escapeValue)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}
