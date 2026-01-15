"use client";

import { useEffect, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import {
  RxHamburgerMenu as LeftDrawer,
  RxHamburgerMenu as RightDrawer,
} from "react-icons/rx";
import type { RoadmapItem } from "@/types/roadmap";
import { loadRoadmap } from "@/lib/loadRoadmap";
import { parseRegions, type Region } from "@/lib/region";
import { getQuarterStartDate } from "@/lib/timeScale";
import { parseStakeholders } from "@/lib/stakeholders";
import { parseRoadmapCsv } from "@/lib/loadRoadmapFromCsv";
import { RoadmapFilters } from "@/components/roadmap/RoadmapFilters";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { SavedViewsPanel } from "@/components/roadmap/SavedViewsPanel";
import type {
  DisplayOptions,
  GroupByOption,
  SavedView,
  ThemeOption,
  ViewPayload,
  ViewScope,
} from "@/types/views";

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RoadmapItem[]>([]);
  const [currentCsvText, setCurrentCsvText] = useState("");
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [selectedCriticalities, setSelectedCriticalities] = useState<string[]>(
    []
  );
  const [selectedImpactedStakeholders, setSelectedImpactedStakeholders] =
    useState<string[]>([]);
  const [selectedGroupBy, setSelectedGroupBy] =
    useState<GroupByOption>("pillar");
  const defaultDisplayOptions: DisplayOptions = {
    showRegionEmojis: true,
    showShortDescription: true,
    titleAbove: false,
    itemVerticalPadding: 6,
    laneDividerOpacity: 0.12,
    itemStyle: "tile" as "tile" | "line",
    lineTitleGap: 2,
    showQuarters: true,
    showMonths: false,
    showDynamicHeader: true,
    darkMode: false,
  };
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(
    defaultDisplayOptions
  );
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>("executive");
  const [titlePrefix, setTitlePrefix] = useState("Technology Roadmap");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(titlePrefix);
  const [startDate, setStartDate] = useState(() =>
    formatDateInput(getQuarterStartDate(new Date()))
  );
  const [quartersToShow, setQuartersToShow] = useState(5);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDraggingCsv, setIsDraggingCsv] = useState(false);
  const [showDebugOutlines, setShowDebugOutlines] = useState(false);
  const [personalViews, setPersonalViews] = useState<SavedView[]>([]);
  const [sharedViews, setSharedViews] = useState<SavedView[]>([]);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [shareBaseUrl, setShareBaseUrl] = useState("");
  const [loadedSharedSlug, setLoadedSharedSlug] = useState("");
  const [loadedView, setLoadedView] = useState<SavedView | null>(null);

  useEffect(() => {
    loadRoadmap().then((data) => {
      setItems(data);
      setFilteredItems(data);
    });
    fetch("/data/roadmap.csv")
      .then((res) => res.text())
      .then((text) => setCurrentCsvText(text))
      .catch(() => {
        setCurrentCsvText("");
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storage = window.sessionStorage;
    let tabId = storage.getItem("roadmap-tab-id");
    if (!tabId) {
      const fallback = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      tabId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : fallback;
      storage.setItem("roadmap-tab-id", tabId);
    }
    setSettingsKey(`roadmap-viewer-settings:${tabId}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setShowDebugOutlines(params.get("debug") === "1");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle(
      "dark",
      displayOptions.darkMode
    );
  }, [displayOptions.darkMode]);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(titlePrefix);
    }
  }, [isEditingTitle, titlePrefix]);

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
      payload.filters?.impactedStakeholders ?? []
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

  const handleLoadView = (view: SavedView) => {
    applyViewPayload(view.payload);
    setLoadedView(view);
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      if (view.sharedSlug) {
        nextUrl.searchParams.set("view", view.sharedSlug);
        nextUrl.searchParams.delete("viewId");
        setLoadedSharedSlug(view.sharedSlug);
      } else {
        nextUrl.searchParams.set("viewId", view.id);
        nextUrl.searchParams.delete("view");
        setLoadedSharedSlug("");
      }
      window.history.replaceState(null, "", nextUrl.toString());
    }
  };

  const handleUpdateView = async (view: SavedView): Promise<boolean> => {
    if (!isSignedIn) return false;
    const payload = buildViewPayload();
    try {
      const res = await fetch(`/api/views/${view.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      if (!res.ok) return false;
      const updatedView = {
        ...view,
        payload,
        updatedAt: new Date().toISOString(),
      };
      setLoadedView(updatedView);
      await fetchViews();
      return true;
    } catch {
      return false;
    }
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
        fetch("/api/views?scope=personal"),
        fetch("/api/views?scope=shared"),
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
    await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scope, payload }),
    });
    await fetchViews();
  };

  const handleRenameView = async (
    id: string,
    _scope: ViewScope,
    name: string
  ) => {
    if (!isSignedIn) return;
    await fetch(`/api/views/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await fetchViews();
  };

  const handleDeleteView = async (id: string, _scope: ViewScope) => {
    if (!isSignedIn) return;
    await fetch(`/api/views/${id}`, { method: "DELETE" });
    if (loadedView?.id === id && typeof window !== "undefined") {
      setLoadedView(null);
      setLoadedSharedSlug("");
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("view");
      nextUrl.searchParams.delete("viewId");
      window.history.replaceState(null, "", nextUrl.toString());
    }
    await fetchViews();
  };

  const handleGenerateLink = async (id: string) => {
    if (!isSignedIn) return;
    await fetch(`/api/views/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("view") ?? "";
    if (!slug || slug === loadedSharedSlug) return;
    const fetchSharedView = async () => {
      try {
        const res = await fetch(`/api/views/slug/${slug}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.view?.payload) {
          applyViewPayload(data.view.payload as ViewPayload);
          if (data.view) {
            setLoadedView(data.view as SavedView);
          }
          setLoadedSharedSlug(slug);
        }
      } catch {
        // Ignore fetch errors for shared views.
      }
    };
    fetchSharedView();
  }, [isSignedIn, loadedSharedSlug]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get("viewId") ?? "";
    if (!viewId || loadedView?.id === viewId) return;
    const match = personalViews.find((view) => view.id === viewId);
    if (!match) return;
    handleLoadView(match);
  }, [isSignedIn, personalViews, loadedView?.id]);

  const handleCsvDownload = () => {
    const csv = currentCsvText || buildCsvFromItems(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roadmap.csv";
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
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    const exportNode = document.getElementById("roadmap-export");
    if (!exportNode) {
      setIsExporting(false);
      return;
    }
    const scrollContainer = exportNode.querySelector<HTMLElement>(
      "[data-roadmap-scroll]"
    );
    const maxWidthContainer = exportNode.closest<HTMLElement>(".max-w-7xl");
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
    exportNode.style.maxWidth = "none";
    if (scrollContainer) {
      scrollContainer.style.width = `${targetWidth}px`;
      scrollContainer.style.overflowX = "visible";
    }
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(exportNode, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
    });
    exportNode.style.width = previousExportWidth;
    exportNode.style.maxWidth = previousExportMaxWidth;
    if (scrollContainer) {
      scrollContainer.style.width = previousScrollWidth ?? "";
      scrollContainer.style.overflowX = previousScrollOverflow ?? "";
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "roadmap.png";
    link.click();
    setIsExporting(false);
  };

  const summaryViewBy = {
    pillar: "Pillar",
    stakeholder: "Primary stakeholder",
    criticality: "Criticality",
    region: "Region",
  }[selectedGroupBy];

  const appliedFilters = [
    selectedPillars.length ? `Pillars: ${selectedPillars.join(", ")}` : null,
    selectedRegions.length ? `Regions: ${selectedRegions.join(", ")}` : null,
    selectedCriticalities.length
      ? `Criticality: ${selectedCriticalities.join(", ")}`
      : null,
    selectedImpactedStakeholders.length
      ? `Stakeholders: ${selectedImpactedStakeholders.join(", ")}`
      : null,
  ].filter(Boolean) as string[];

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
        selectedGroupBy: "pillar" | "stakeholder" | "criticality" | "region";
        selectedTheme:
          | "coastal"
          | "orchard"
          | "sunset"
          | "sand"
          | "mono"
          | "forest"
          | "metro"
          | "metro-dark"
          | "executive";
        titlePrefix: string;
        displayOptions: {
          showRegionEmojis: boolean;
          showShortDescription: boolean;
          titleAbove: boolean;
          itemVerticalPadding: number;
          laneDividerOpacity: number;
          itemStyle: "tile" | "line";
          lineTitleGap: number;
          showQuarters: boolean;
          showMonths: boolean;
          showDynamicHeader: boolean;
          darkMode: boolean;
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
      if (typeof parsed.isHeaderCollapsed === "boolean") {
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
        selectedCriticalities.includes(i.criticality)
      );
    }
    if (selectedImpactedStakeholders.length > 0) {
      result = result.filter((i) => {
        const stakeholders = parseStakeholders(i.impactedStakeholders);
        return selectedImpactedStakeholders.some((stakeholder) =>
          stakeholders.includes(stakeholder)
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
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className={[
          "max-w-screen-2xl mx-auto px-4 py-8 space-y-6",
          showDebugOutlines
            ? "outline outline-1 outline-dashed outline-rose-300/80"
            : "",
        ].join(" ")}
      >
        <header
          className={[
            "flex flex-wrap items-start justify-between gap-4",
            showDebugOutlines
              ? "outline outline-1 outline-dashed outline-blue-300/80"
              : "",
          ].join(" ")}
        >
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="text-blue-700">Roadmap</span>{" "}
              <span className="text-slate-900 dark:text-slate-100">to</span>{" "}
              <span className="text-red-600">Liberty</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Visualize roadmap ideas across pillars, time, and regions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Please sign in to view the roadmap.
          </div>
        </SignedOut>

        <SignedIn>
          <div
            className={[
              "space-y-6",
              showDebugOutlines
                ? "outline outline-1 outline-dashed outline-amber-300/80"
                : "",
            ].join(" ")}
          >
            <div
              className={[
                "flex flex-wrap items-center gap-3",
                displayOptions.showDynamicHeader
                  ? "justify-between"
                  : "justify-end",
                showDebugOutlines
                  ? "outline outline-1 outline-dashed outline-sky-300/80"
                  : "",
              ].join(" ")}
            >
              {displayOptions.showDynamicHeader ? (
                <div className="flex items-center gap-2 min-w-0">
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onBlur={() => {
                        const nextTitle = titleDraft.trim();
                        if (nextTitle) {
                          setTitlePrefix(nextTitle);
                        } else {
                          setTitleDraft(titlePrefix);
                        }
                        setIsEditingTitle(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          setTitleDraft(titlePrefix);
                          setIsEditingTitle(false);
                        }
                      }}
                      className="w-full max-w-md rounded-md border border-slate-200 bg-white px-2 py-1 text-xl font-semibold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-700"
                      aria-label="Edit roadmap title"
                      autoFocus
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-left text-xl font-semibold text-slate-900 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-200 truncate"
                        onClick={() => {
                          setTitleDraft(titlePrefix);
                          setIsEditingTitle(true);
                        }}
                        title="Edit title"
                        aria-label="Edit roadmap title"
                      >
                        {titlePrefix}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                        onClick={() => {
                          setTitleDraft(titlePrefix);
                          setIsEditingTitle(true);
                        }}
                        title="Edit title"
                        aria-label="Edit roadmap title"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className={[
                    "relative flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-slate-700",
                    isDraggingCsv
                      ? "border-sky-400 bg-sky-50 dark:border-sky-500/70 dark:bg-sky-950/40"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600",
                  ].join(" ")}
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
                    onChange={(event) =>
                      handleCsvFile(event.target.files?.[0])
                    }
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
                  <span className="text-slate-400 dark:text-slate-500">or drop</span>
                </label>
                <button
                  type="button"
                  onClick={handleCsvDownload}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
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
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
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
                  {isExporting ? "Exporting..." : "Export Image"}
                </button>
              </div>
            </div>

            <div
              className={[
                "flex gap-6",
                showDebugOutlines
                  ? "outline outline-1 outline-dashed outline-emerald-300/80"
                  : "",
              ].join(" ")}
            >
              <aside
                className={[
                  "relative transition-[width] duration-300 ease-out",
                  isHeaderCollapsed ? "w-0" : "w-80",
                  "shrink-0",
                  "overflow-visible",
                  showDebugOutlines
                    ? "outline outline-1 outline-dashed outline-rose-300/80"
                    : "",
                ].join(" ")}
              >
                <div className="sticky top-6 space-y-4">
                  <button
                    type="button"
                    onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                    className={[
                      "absolute top-6 right-0 translate-x-1/2 rounded-full border bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-100",
                      "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
                    ].join(" ")}
                  >
                    {isHeaderCollapsed ? (
                      <RightDrawer className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <LeftDrawer className="h-5 w-5" aria-hidden="true" />
                    )}
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
                        selectedImpactedStakeholders={
                          selectedImpactedStakeholders
                        }
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
                            onUpdateView={handleUpdateView}
                            activeViewId={loadedView?.id ?? null}
                          />
                        }
                        showDebugOutlines={showDebugOutlines}
                      />
                    </>
                  )}
                </div>
              </aside>

              <div
                className={[
                  "min-w-0 flex-1",
                  showDebugOutlines
                    ? "outline outline-1 outline-dashed outline-violet-300/80"
                    : "",
                ].join(" ")}
              >
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
                  showDebugOutlines={showDebugOutlines}
                />
              </div>
            </div>
          </div>
        </SignedIn>
      </div>
    </main>
  );
}

function formatDateInput(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCsvFromItems(items: RoadmapItem[]): string {
  const headers = [
    "id",
    "title",
    "url",
    "impactedStakeholders",
    "submitterName",
    "submitterDepartment",
    "submitterPriority",
    "shortDescription",
    "longDescription",
    "criticality",
    "executiveSponsor",
    "startDate",
    "endDate",
    "tShirtSize",
    "pillar",
    "region",
    "expenseType",
    "pointOfContact",
    "lead",
  ];
  const escapeValue = (value: string) => {
    const safe = value ?? "";
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
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}
