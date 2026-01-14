'use client';

import { useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/nextjs';
import type { RoadmapItem } from '@/types/roadmap';
import { loadRoadmap } from '@/lib/loadRoadmap';
import { parseRegions, type Region } from '@/lib/region';
import { getQuarterStartDate } from '@/lib/timeScale';
import { parseStakeholders } from '@/lib/stakeholders';
import { parseRoadmapCsv } from '@/lib/loadRoadmapFromCsv';
import { RoadmapFilters } from '@/components/roadmap/RoadmapFilters';
import { RoadmapTimeline } from '@/components/roadmap/RoadmapTimeline';
import { SavedViewsPanel } from '@/components/roadmap/SavedViewsPanel';
import type {
  DisplayOptions,
  GroupByOption,
  SavedView,
  ThemeOption,
  ViewPayload,
  ViewScope,
} from '@/types/views';

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
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
  const [selectedGroupBy, setSelectedGroupBy] =
    useState<GroupByOption>('pillar');
  const defaultDisplayOptions: DisplayOptions = {
    showRegionEmojis: true,
    showShortDescription: true,
    titleAbove: false,
    itemVerticalPadding: 6,
    laneDividerOpacity: 0.12,
    itemStyle: 'tile' as 'tile' | 'line',
    lineTitleGap: 2,
    showQuarters: true,
    showMonths: false,
    showDynamicHeader: true,
  };
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(
    defaultDisplayOptions,
  );
  const [selectedTheme, setSelectedTheme] =
    useState<ThemeOption>('coastal');
  const [titlePrefix, setTitlePrefix] = useState('Technology Roadmap');
  const [startDate, setStartDate] = useState(() =>
    formatDateInput(getQuarterStartDate(new Date())),
  );
  const [quartersToShow, setQuartersToShow] = useState(5);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [personalViews, setPersonalViews] = useState<SavedView[]>([]);
  const [sharedViews, setSharedViews] = useState<SavedView[]>([]);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [shareBaseUrl, setShareBaseUrl] = useState('');
  const [loadedSharedSlug, setLoadedSharedSlug] = useState('');
  const [loadedViewName, setLoadedViewName] = useState('');

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage = window.sessionStorage;
    let tabId = storage.getItem('roadmap-tab-id');
    if (!tabId) {
      const fallback = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : fallback;
      storage.setItem('roadmap-tab-id', tabId);
    }
    setSettingsKey(`roadmap-viewer-settings:${tabId}`);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShareBaseUrl(window.location.origin);
  }, []);

  const buildViewPayload = (): ViewPayload => ({
    filters: {
      pillars: selectedPillars,
      regions: selectedRegions,
      criticalities: selectedCriticalities,
      impactedStakeholders: selectedImpactedStakeholders,
    },
    display: {
      groupBy: selectedGroupBy,
      theme: selectedTheme,
      titlePrefix,
      options: displayOptions,
    },
    timeline: {
      startDate,
      quartersToShow,
    },
  });

  const applyViewPayload = (payload: ViewPayload) => {
    setSelectedPillars(payload.filters?.pillars ?? []);
    setSelectedRegions(payload.filters?.regions ?? []);
    setSelectedCriticalities(payload.filters?.criticalities ?? []);
    setSelectedImpactedStakeholders(
      payload.filters?.impactedStakeholders ?? [],
    );
    if (payload.display?.groupBy) {
      setSelectedGroupBy(payload.display.groupBy);
    }
    if (payload.display?.theme) {
      setSelectedTheme(payload.display.theme);
    }
    if (payload.display?.titlePrefix) {
      setTitlePrefix(payload.display.titlePrefix);
    }
    if (payload.display?.options) {
      setDisplayOptions({
        ...defaultDisplayOptions,
        ...payload.display.options,
      });
    }
    if (payload.timeline?.startDate) {
      setStartDate(payload.timeline.startDate);
    }
    if (payload.timeline?.quartersToShow) {
      setQuartersToShow(payload.timeline.quartersToShow);
    }
  };

  const handleLoadView = (payload: ViewPayload, name: string) => {
    applyViewPayload(payload);
    setLoadedViewName(name);
  };

  const fetchViews = async () => {
    if (!isSignedIn) {
      setPersonalViews([]);
      setSharedViews([]);
      return;
    }
    setIsLoadingViews(true);
    try {
      const [personalRes, sharedRes] = await Promise.all([
        fetch('/api/views?scope=personal'),
        fetch('/api/views?scope=shared'),
      ]);
      const personalData = await personalRes.json();
      const sharedData = await sharedRes.json();
      setPersonalViews(personalData.views ?? []);
      setSharedViews(sharedData.views ?? []);
    } catch {
      setPersonalViews([]);
      setSharedViews([]);
    } finally {
      setIsLoadingViews(false);
    }
  };

  const handleSaveView = async (name: string, scope: ViewScope) => {
    if (!isSignedIn) return;
    const payload = buildViewPayload();
    await fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scope, payload }),
    });
    await fetchViews();
  };

  const handleRenameView = async (
    id: string,
    _scope: ViewScope,
    name: string,
  ) => {
    if (!isSignedIn) return;
    await fetch(`/api/views/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await fetchViews();
  };

  const handleDeleteView = async (id: string, _scope: ViewScope) => {
    if (!isSignedIn) return;
    await fetch(`/api/views/${id}`, { method: 'DELETE' });
    await fetchViews();
  };

  const handleGenerateLink = async (id: string) => {
    if (!isSignedIn) return;
    await fetch(`/api/views/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generateSlug: true }),
    });
    await fetchViews();
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setPersonalViews([]);
      setSharedViews([]);
      return;
    }
    fetchViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('view') ?? '';
    if (!slug || slug === loadedSharedSlug) return;
    const fetchSharedView = async () => {
      try {
        const res = await fetch(`/api/views/slug/${slug}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.view?.payload) {
          applyViewPayload(data.view.payload as ViewPayload);
          if (data.view?.name) {
            setLoadedViewName(data.view.name);
          }
          setLoadedSharedSlug(slug);
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.delete('view');
          window.history.replaceState(null, '', nextUrl.toString());
        }
      } catch {
        // Ignore fetch errors for shared views.
      }
    };
    fetchSharedView();
  }, [isSignedIn, loadedSharedSlug]);

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
    const scrollContainer = exportNode.querySelector<HTMLElement>(
      '[data-roadmap-scroll]',
    );
    const maxWidthContainer = exportNode.closest<HTMLElement>('.max-w-7xl');
    const computedMaxWidth = maxWidthContainer
      ? parseFloat(window.getComputedStyle(maxWidthContainer).maxWidth)
      : NaN;
    const previousExportWidth = exportNode.style.width;
    const previousExportMaxWidth = exportNode.style.maxWidth;
    const previousScrollWidth = scrollContainer?.style.width;
    const previousScrollOverflow = scrollContainer?.style.overflowX;
    const fullWidth =
      scrollContainer?.scrollWidth ||
      exportNode.scrollWidth ||
      exportNode.clientWidth;
    const targetWidth =
      Number.isFinite(computedMaxWidth) && computedMaxWidth > 0
        ? computedMaxWidth
        : fullWidth;

    exportNode.style.width = `${targetWidth}px`;
    exportNode.style.maxWidth = 'none';
    if (scrollContainer) {
      scrollContainer.style.width = `${targetWidth}px`;
      scrollContainer.style.overflowX = 'visible';
    }
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(exportNode, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
    });
    exportNode.style.width = previousExportWidth;
    exportNode.style.maxWidth = previousExportMaxWidth;
    if (scrollContainer) {
      scrollContainer.style.width = previousScrollWidth ?? '';
      scrollContainer.style.overflowX = previousScrollOverflow ?? '';
    }
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

  const filterChips = [
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

  useEffect(() => {
    if (!settingsKey) return;
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
        titlePrefix: string;
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
      if (parsed.titlePrefix) setTitlePrefix(parsed.titlePrefix);
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
    if (!isHydrated || !settingsKey) return;
    const payload = {
      selectedPillars,
      selectedRegions,
      selectedCriticalities,
      selectedImpactedStakeholders,
      selectedGroupBy,
      selectedTheme,
      titlePrefix,
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
    titlePrefix,
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
      <div className="max-w-screen-2xl mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="text-blue-700">Roadmap</span>{' '}
              <span className="text-slate-900">to</span>{' '}
              <span className="text-red-600">Liberty</span>
            </h1>
            <p className="text-sm text-slate-600">
              Visualize roadmap ideas across pillars, time, and regions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <SignedOut>
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Please sign in to view the roadmap.
          </div>
        </SignedOut>

        <SignedIn>
        <div className="flex gap-6">
          <aside
            className={[
              'relative transition-[width] duration-300 ease-out',
              isHeaderCollapsed ? 'w-0' : 'w-80',
              'shrink-0',
              'overflow-visible',
            ].join(' ')}
          >
            <div className="sticky top-6 space-y-4">
              <button
                type="button"
                onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                className={[
                  'absolute top-6 right-0 translate-x-1/2 rounded-full border bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-100',
                ].join(' ')}
              >
                <span className="text-base leading-none">
                  ≡
                </span>
              </button>

              {isHeaderCollapsed ? null : (
                <>
                  <RoadmapFilters
                    items={items}
                    selectedPillars={selectedPillars}
                    setSelectedPillars={setSelectedPillars}
                    selectedRegions={selectedRegions}
                    setSelectedRegions={setSelectedRegions}
                    selectedCriticalities={selectedCriticalities}
                    setSelectedCriticalities={setSelectedCriticalities}
                    selectedImpactedStakeholders={selectedImpactedStakeholders}
                    setSelectedImpactedStakeholders={
                      setSelectedImpactedStakeholders
                    }
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
                    titlePrefix={titlePrefix}
                    setTitlePrefix={setTitlePrefix}
                    savedViewsPanel={
                      <SavedViewsPanel
                        isLoading={isLoadingViews}
                        personalViews={personalViews}
                        sharedViews={sharedViews}
                        shareBaseUrl={shareBaseUrl}
                        onSaveView={handleSaveView}
                        onLoadView={handleLoadView}
                        onRenameView={handleRenameView}
                        onDeleteView={handleDeleteView}
                        onGenerateLink={handleGenerateLink}
                      />
                    }
                  />
                </>
              )}
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-6">
            <div
              className={[
                'flex flex-wrap items-center gap-3',
                displayOptions.showDynamicHeader
                  ? 'justify-between'
                  : 'justify-end',
              ].join(' ')}
            >
              {displayOptions.showDynamicHeader ? (
                <h2 className="text-xl font-semibold text-slate-900">
                  {titlePrefix} By {summaryViewBy}
                </h2>
              ) : null}
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
                  <span className="inline-flex h-4 w-4 items-center justify-center text-sky-600">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 21V9" />
                      <path d="M7 14l5-5 5 5" />
                      <path d="M5 3h14" />
                    </svg>
                  </span>
                  <span>Upload CSV</span>
                  <span className="text-slate-400">or drop</span>
                </label>
                <button
                  type="button"
                  onClick={handleCsvDownload}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center text-emerald-600">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v12" />
                      <path d="M7 10l5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                  </span>
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportImage}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  disabled={isExporting}
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center text-amber-600">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M8 13l2-2 3 3 3-4 2 3" />
                      <circle cx="8.5" cy="9" r="1" />
                    </svg>
                  </span>
                  {isExporting ? 'Exporting...' : 'Export Image'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {loadedViewName ? (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                  <span className="text-slate-500">Loaded view:</span>
                  <span className="font-medium">{loadedViewName}</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600"
                    onClick={() => setLoadedViewName('')}
                    aria-label="Dismiss loaded view"
                  >
                    ×
                  </button>
                </div>
              ) : null}
              {filterChips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {filterChips.map((chip) => (
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
            </div>

            <RoadmapTimeline
              items={filteredItems}
              groupBy={selectedGroupBy}
              displayOptions={displayOptions}
              theme={selectedTheme}
              startDate={startDate}
              quartersToShow={quartersToShow}
              exportSummary={{
                viewBy: summaryViewBy,
                titlePrefix,
                filters: appliedFilters,
              }}
              isExporting={isExporting}
            />
          </div>
        </div>
        </SignedIn>
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
