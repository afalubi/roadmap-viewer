"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import type { RoadmapItem } from "@/types/roadmap";
import { loadRoadmap } from "@/lib/loadRoadmap";
import { parseRegions, type Region } from "@/lib/region";
import { getQuarterStartDate } from "@/lib/timeScale";
import { parseStakeholders } from "@/lib/stakeholders";
import { parseRoadmapCsv } from "@/lib/loadRoadmapFromCsv";
import { buildCsvFromItems } from "@/lib/roadmapCsv";
import { RoadmapFilters } from "@/components/roadmap/RoadmapFilters";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { UnplannedList } from "@/components/roadmap/UnplannedList";
import { RoadmapManagerPanel } from "@/components/roadmap/RoadmapManagerPanel";
import { SavedViewsPanel } from "@/components/roadmap/SavedViewsPanel";
import type { RoadmapDetail, RoadmapSummary } from "@/types/roadmaps";
import type {
  DisplayOptions,
  GroupByOption,
  SavedView,
  ThemeOption,
  ViewPayload,
} from "@/types/views";

type RoadmapPageMode = "planned" | "unplanned";

export function RoadmapPage({ mode }: { mode: RoadmapPageMode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const lastUserIdRef = useRef<string | null>(null);
  const [settingsKey, setSettingsKey] = useState<string | null>(null);
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RoadmapItem[]>([]);
  const [currentCsvText, setCurrentCsvText] = useState("");
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [selectedCriticalities, setSelectedCriticalities] = useState<string[]>(
    []
  );
  const [selectedDispositions, setSelectedDispositions] = useState<string[]>(
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
  const [titlePrefix, setTitlePrefix] = useState("My Roadmap");
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
  const [views, setViews] = useState<SavedView[]>([]);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [isLoadingRoadmaps, setIsLoadingRoadmaps] = useState(false);
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [activeRoadmapRole, setActiveRoadmapRole] = useState<
    RoadmapSummary["role"] | null
  >(null);
  const [activeDatasourceType, setActiveDatasourceType] = useState<
    RoadmapDetail["datasourceType"] | null
  >(null);
  const [datasourceDebug, setDatasourceDebug] = useState<{
    count: number;
    stale: boolean;
    truncated: boolean;
    warning: string | null;
    error: string | null;
  } | null>(null);
  const [loadedRoadmapSlug, setLoadedRoadmapSlug] = useState("");
  const [isRoadmapManageOpen, setIsRoadmapManageOpen] = useState(false);
  const [shareRoadmapId, setShareRoadmapId] = useState<string | null>(null);
  const [shareBaseUrl, setShareBaseUrl] = useState("");
  const [loadedSharedSlug, setLoadedSharedSlug] = useState("");
  const [loadedView, setLoadedView] = useState<SavedView | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateOnlineStatus = () => {
      setIsOnline(window.navigator.onLine);
    };
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("roadmap") || params.get("roadmapId") || params.get("view")) {
        return;
      }
    }
    if (!isSignedIn) {
      if (!isOnline) return;
      loadRoadmap()
        .then((data) => {
          setItems(data);
          setFilteredItems(data);
        })
        .catch(() => {
          setItems([]);
          setFilteredItems([]);
        });
    }
  }, [isLoaded, isSignedIn, isOnline]);

  useEffect(() => {
    if (isSignedIn) {
      return;
    }
    if (!isOnline) {
      setCurrentCsvText("");
      return;
    }
    fetch("/data/roadmap.csv")
      .then((res) => res.text())
      .then((text) => setCurrentCsvText(text))
      .catch(() => {
        setCurrentCsvText("");
      });
  }, [isSignedIn, isOnline]);

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
      dispositions: selectedDispositions,
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
    setSelectedDispositions(payload.filters?.dispositions ?? []);
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

  const handleLoadView = async (view: SavedView) => {
    if (view.roadmapId && view.roadmapId !== activeRoadmapId) {
      await loadRoadmapById(view.roadmapId);
    }
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
      if (view.roadmapId) {
        nextUrl.searchParams.set("roadmapId", view.roadmapId);
        nextUrl.searchParams.delete("roadmap");
      }
      window.history.replaceState(null, "", nextUrl.toString());
    }
  };

  const handleUpdateView = async (view: SavedView): Promise<boolean> => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
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

  const fetchRoadmaps = async () => {
    if (!isSignedIn) {
      setRoadmaps([]);
      setActiveRoadmapId(null);
      setActiveRoadmapRole(null);
      setActiveDatasourceType(null);
      return;
    }
    if (!isOnline) {
      setIsLoadingRoadmaps(false);
      return;
    }
    setIsLoadingRoadmaps(true);
    try {
      const res = await fetch("/api/roadmaps");
      const data = await res.json();
      const list = (data.roadmaps ?? []) as RoadmapSummary[];
      setRoadmaps(list);
      if (list.length === 0) {
        setActiveRoadmapId(null);
        setActiveRoadmapRole(null);
        setActiveDatasourceType(null);
        setViews([]);
        setLoadedView(null);
        setLoadedSharedSlug("");
        setLoadedRoadmapSlug("");
        setItems([]);
        setFilteredItems([]);
        return;
      }
      const activeMatch = activeRoadmapId
        ? list.find((roadmap) => roadmap.id === activeRoadmapId)
        : null;
      if (activeMatch) {
        setActiveRoadmapRole(activeMatch.role);
      } else if (activeRoadmapId) {
        setActiveRoadmapRole(null);
        setActiveDatasourceType(null);
      }
    } catch {
      setRoadmaps([]);
    } finally {
      setIsLoadingRoadmaps(false);
    }
  };

  const applyRoadmapItems = (nextItems: RoadmapItem[], csvText = "") => {
    setItems(nextItems);
    setFilteredItems(nextItems);
    setSelectedPillars([]);
    setSelectedRegions([]);
    setSelectedCriticalities([]);
    setSelectedImpactedStakeholders([]);
    setCurrentCsvText(csvText);
  };

  const fetchDatasourceItems = async (roadmapId: string, forceRefresh = false) => {
    if (!isOnline) {
      setDatasourceDebug({
        count: 0,
        stale: false,
        truncated: false,
        warning: null,
        error: "You're offline. Datasource refresh paused.",
      });
      return null;
    }
    try {
      const res = await fetch(
        `/api/roadmaps/${roadmapId}/datasource/items${forceRefresh ? "?refresh=1" : ""}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDatasourceDebug({
          count: 0,
          stale: false,
          truncated: false,
          warning: null,
          error: data?.error ?? `Datasource fetch failed (${res.status}).`,
        });
        return null;
      }
      const data = (await res.json()) as {
        items?: RoadmapItem[];
        stale?: boolean;
        truncated?: boolean;
        warning?: string | null;
      };
      const items = Array.isArray(data.items) ? data.items : [];
      setDatasourceDebug({
        count: items.length,
        stale: Boolean(data.stale),
        truncated: Boolean(data.truncated),
        warning: data.warning ?? null,
        error: null,
      });
      return items;
    } catch {
      setDatasourceDebug({
        count: 0,
        stale: false,
        truncated: false,
        warning: null,
        error: "Datasource fetch failed.",
      });
      return null;
    }
  };

  const loadRoadmapById = async (roadmapId: string) => {
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/roadmaps/${roadmapId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { roadmap?: RoadmapDetail };
      if (data.roadmap) {
        const datasourceType = data.roadmap.datasourceType ?? "csv";
        setActiveDatasourceType(datasourceType);
        setActiveRoadmapId(data.roadmap.id);
        setActiveRoadmapRole(data.roadmap.role);
        const items = await fetchDatasourceItems(data.roadmap.id, true);
        if (items) {
          applyRoadmapItems(items);
          return;
        }
        if (typeof data.roadmap.csvText === "string") {
          applyCsvText(data.roadmap.csvText);
        }
      }
    } catch {
      // Ignore load errors.
    }
  };

  const loadRoadmapBySlug = async (slug: string, password?: string) => {
    if (!isOnline) return;
    try {
      const res = await fetch(`/api/roadmaps/slug/${slug}`, {
        headers: password
          ? { "x-roadmap-link-password": password }
          : undefined,
      });
      if (res.status === 401) {
        const data = await res.json();
        if (data?.requiresPassword) {
          const promptValue = window.prompt("Enter the roadmap password");
          if (promptValue) {
            await loadRoadmapBySlug(slug, promptValue);
          }
        }
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { roadmap?: RoadmapDetail };
      if (data.roadmap) {
        setActiveRoadmapId(data.roadmap.id);
        setActiveRoadmapRole(data.roadmap.role);
        setActiveDatasourceType(data.roadmap.datasourceType ?? "csv");
        setLoadedRoadmapSlug(slug);
        setLoadedView(null);
        setLoadedSharedSlug("");
        setShareRoadmapId(null);
        if (Array.isArray((data.roadmap as any).items)) {
          applyRoadmapItems((data.roadmap as any).items as RoadmapItem[]);
          setDatasourceDebug({
            count: (data.roadmap as any).items.length,
            stale: false,
            truncated: false,
            warning: null,
            error: null,
          });
          return;
        }
        if (typeof data.roadmap.csvText === "string") {
          applyCsvText(data.roadmap.csvText);
        }
      }
    } catch {
      // Ignore load errors.
    }
  };

  const handleLoadRoadmap = async (roadmap: RoadmapSummary) => {
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("roadmapId", roadmap.id);
      nextUrl.searchParams.delete("roadmap");
      window.history.replaceState(null, "", nextUrl.toString());
    }
    setLoadedRoadmapSlug("");
    setLoadedView(null);
    setLoadedSharedSlug("");
    setShareRoadmapId(null);
    await loadRoadmapById(roadmap.id);
  };

  const fetchViews = async () => {
    if (!isSignedIn) {
      setViews([]);
      return;
    }
    if (!activeRoadmapId) {
      setViews([]);
      return;
    }
    if (!isOnline) {
      setIsLoadingViews(false);
      return;
    }
    setIsLoadingViews(true);
    try {
      const res = await fetch(`/api/views?roadmapId=${activeRoadmapId}`);
      const data = await res.json();
      setViews(data.views ?? []);
    } catch {
      setViews([]);
    } finally {
      setIsLoadingViews(false);
    }
  };

  const handleSaveView = async (name: string) => {
    if (!isSignedIn) return;
    if (!activeRoadmapId) return;
    if (!isOnline) return;
    const payload = buildViewPayload();
    await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload, roadmapId: activeRoadmapId }),
    });
    await fetchViews();
  };

  const handleRenameView = async (id: string, name: string) => {
    if (!isSignedIn) return;
    if (!isOnline) return;
    await fetch(`/api/views/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await fetchViews();
  };

  const handleDeleteView = async (id: string) => {
    if (!isSignedIn) return;
    if (!isOnline) return;
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

  const handleCreateLink = async (
    id: string,
    options: { password?: string | null; rotate?: boolean }
  ) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/views/${id}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!res.ok) return false;
    await fetchViews();
    return true;
  };

  const handleDeleteLink = async (id: string) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/views/${id}/link`, { method: "DELETE" });
    if (!res.ok) return false;
    await fetchViews();
    return true;
  };

  const handleCreateRoadmap = async (name: string, csvText: string) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch("/api/roadmaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, csvText }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.roadmap?.id) {
      setActiveRoadmapId(data.roadmap.id);
      setActiveRoadmapRole(data.roadmap.role);
      applyCsvText(csvText);
      setLoadedRoadmapSlug("");
      setLoadedSharedSlug("");
      setLoadedView(null);
      setShareRoadmapId(null);
      if (typeof window !== "undefined") {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("roadmapId", data.roadmap.id);
        nextUrl.searchParams.delete("roadmap");
        window.history.replaceState(null, "", nextUrl.toString());
      }
    }
    await fetchRoadmaps();
    return true;
  };

  const handleRenameRoadmap = async (id: string, name: string) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/roadmaps/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return false;
    await fetchRoadmaps();
    return true;
  };

  const handleDeleteRoadmap = async (id: string) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/roadmaps/${id}`, { method: "DELETE" });
    if (!res.ok) return false;
    if (activeRoadmapId === id && typeof window !== "undefined") {
      setActiveRoadmapId(null);
      setActiveRoadmapRole(null);
      setActiveDatasourceType(null);
      setViews([]);
      setShareRoadmapId(null);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("roadmap");
      nextUrl.searchParams.delete("roadmapId");
      window.history.replaceState(null, "", nextUrl.toString());
    }
    await fetchRoadmaps();
    return true;
  };

  const handleShareRoadmapUser = async (
    id: string,
    targetUserId: string,
    role: "viewer" | "editor" | "owner"
  ) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/roadmaps/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, role }),
    });
    return res.ok;
  };

  const handleUpdateRoadmapShare = async (
    id: string,
    targetUserId: string,
    role: "viewer" | "editor" | "owner"
  ) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/roadmaps/${id}/share/${targetUserId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    return res.ok;
  };

  const handleRevokeRoadmapShare = async (
    id: string,
    targetUserId: string
  ) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/roadmaps/${id}/share/${targetUserId}`, {
      method: "DELETE",
    });
    return res.ok;
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setViews([]);
      setRoadmaps([]);
      return;
    }
    if (!isOnline) return;
    fetchRoadmaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, isOnline]);

  useEffect(() => {
    if (!isLoaded) return;
    if (lastUserIdRef.current === null) {
      lastUserIdRef.current = userId ?? null;
      return;
    }
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId ?? null;
      setIsLoadingRoadmaps(true);
      setRoadmaps([]);
      setActiveRoadmapId(null);
      setActiveRoadmapRole(null);
      setActiveDatasourceType(null);
      setViews([]);
      setLoadedView(null);
      setLoadedSharedSlug("");
      setLoadedRoadmapSlug("");
      setFilteredItems([]);
      setItems([]);
    }
  }, [isLoaded, userId]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOnline) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("view") ?? "";
    if (!slug || slug === loadedSharedSlug) return;

    const fetchSharedView = async (password?: string) => {
      try {
        const res = await fetch(`/api/views/slug/${slug}`, {
          headers: password ? { "x-view-link-password": password } : undefined,
        });
        if (res.status === 401) {
          const data = await res.json();
          if (data?.requiresPassword) {
            const promptValue = window.prompt("Enter the share password");
            if (promptValue) {
              await fetchSharedView(promptValue);
            }
          }
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.view?.roadmapCsvText === "string") {
          applyCsvText(data.view.roadmapCsvText as string);
        }
        if (data.view?.payload) {
          applyViewPayload(data.view.payload as ViewPayload);
        }
        if (data.view) {
          setLoadedView(data.view as SavedView);
          if (data.view.roadmapId) {
            setActiveRoadmapId(data.view.roadmapId as string);
            setActiveRoadmapRole("viewer");
          }
        }
        setLoadedSharedSlug(slug);
      } catch {
        // Ignore fetch errors for shared views.
      }
    };

    fetchSharedView();
  }, [loadedSharedSlug, isOnline]);

  useEffect(() => {
    if (!isLoaded) return;
    if (typeof window === "undefined") return;
    if (!isOnline) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("roadmap") ?? "";
    const roadmapIdParam = params.get("roadmapId") ?? "";

    if (slug && slug !== loadedRoadmapSlug) {
      loadRoadmapBySlug(slug);
      return;
    }
    if (isSignedIn && roadmapIdParam && roadmapIdParam !== activeRoadmapId) {
      loadRoadmapById(roadmapIdParam);
      return;
    }
    if (isSignedIn && !activeRoadmapId && roadmaps.length > 0) {
      handleLoadRoadmap(roadmaps[0]);
    }
  }, [
    isLoaded,
    isSignedIn,
    activeRoadmapId,
    loadedRoadmapSlug,
    roadmaps,
    isOnline,
  ]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get("viewId") ?? "";
    if (!viewId || loadedView?.id === viewId) return;
    const match = views.find((view) => view.id === viewId);
    if (!match) return;
    handleLoadView(match);
  }, [isSignedIn, views, loadedView?.id]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (!activeRoadmapId) return;
    if (!isOnline) return;
    fetchViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, activeRoadmapId, isOnline]);

  const handleCsvDownload = () => {
    const csv = currentCsvText || buildCsvFromItems(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const roadmapName =
      roadmaps.find((roadmap) => roadmap.id === activeRoadmapId)?.name ??
      "roadmap";
    const safeName = roadmapName
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[\\/:*?"<>|]+/g, "-");
    const dateSuffix = new Date().toISOString().slice(0, 10);
    link.download = `${safeName || "roadmap"}-${dateSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const applyCsvText = (text: string) => {
    const parsedItems = parseRoadmapCsv(text);
    setItems(parsedItems);
    setFilteredItems(parsedItems);
    setSelectedPillars([]);
    setSelectedRegions([]);
    setSelectedCriticalities([]);
    setSelectedImpactedStakeholders([]);
    setCurrentCsvText(text);
  };

  const handleCsvUploadText = async (text: string) => {
    applyCsvText(text);
    const parsedItems = parseRoadmapCsv(text);
    setDatasourceDebug({
      count: parsedItems.length,
      stale: false,
      truncated: false,
      warning: null,
      error: null,
    });
    if (!isSignedIn || !activeRoadmapId) return;
    if (!activeRoadmapRole || activeRoadmapRole === "viewer") return;
    if (activeDatasourceType && activeDatasourceType !== "csv") return;
    if (!isOnline) return;
    try {
      await fetch(`/api/roadmaps/${activeRoadmapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: text }),
      });
      await fetchRoadmaps();
    } catch {
      // Ignore CSV sync errors for now.
    }
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
    disposition: "Disposition",
  }[selectedGroupBy];

  const appliedFilters = [
    selectedPillars.length ? `Pillars: ${selectedPillars.join(", ")}` : null,
    selectedRegions.length ? `Regions: ${selectedRegions.join(", ")}` : null,
    selectedCriticalities.length
      ? `Criticality: ${selectedCriticalities.join(", ")}`
      : null,
    selectedDispositions.length
      ? `Disposition: ${selectedDispositions.join(", ")}`
      : null,
    selectedImpactedStakeholders.length
      ? `Stakeholders: ${selectedImpactedStakeholders.join(", ")}`
      : null,
  ].filter(Boolean) as string[];

  const viewOptions = views.map((view) => ({
    value: view.id,
    label: `${view.name} (${view.role})`,
    view,
  }));
  const selectedViewValue =
    loadedView && viewOptions.some((option) => option.value === loadedView.id)
      ? loadedView.id
      : "";
  const handleViewSelect = (value: string) => {
    const match = viewOptions.find((option) => option.value === value);
    if (match) {
      handleLoadView(match.view);
    }
  };

  const roadmapOptions = roadmaps.map((roadmap) => ({
    value: roadmap.id,
    label: `${roadmap.name} (${roadmap.role})`,
    roadmap,
  }));
  const selectedRoadmapValue =
    activeRoadmapId &&
    roadmapOptions.some((option) => option.value === activeRoadmapId)
      ? activeRoadmapId
      : "";
  const handleRoadmapSelect = (value: string) => {
    const match = roadmapOptions.find((option) => option.value === value);
    if (match) {
      handleLoadRoadmap(match.roadmap);
    }
  };

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
        selectedDispositions: string[];
        selectedImpactedStakeholders: string[];
        selectedGroupBy:
          | "pillar"
          | "stakeholder"
          | "criticality"
          | "region"
          | "disposition";
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
      if (parsed.selectedDispositions)
        setSelectedDispositions(parsed.selectedDispositions);
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
      selectedDispositions,
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
    selectedDispositions,
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
    if (selectedDispositions.length > 0) {
      result = result.filter((i) =>
        selectedDispositions.includes(i.disposition)
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
    selectedDispositions,
    selectedImpactedStakeholders,
  ]);

  const isUnplanned = mode === "unplanned";
  const plannedItems = filteredItems.filter(hasValidTimelineDates);
  const unplannedItems = filteredItems.filter(
    (item) => !hasValidTimelineDates(item)
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className={[
          "max-w-screen-2xl mx-auto px-4 py-8 space-y-6",
          showDebugOutlines
            ? "relative outline outline-1 outline-dashed outline-rose-300/80"
            : "",
        ].join(" ")}
      >
        {!isOnline ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-sm dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
            You're offline. Viewing cached data; saving, sharing, and sync actions are paused until you're back online.
          </div>
        ) : null}
        {showDebugOutlines ? (
          <span className="absolute -top-3 left-2 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-800">
            MAIN
          </span>
        ) : null}
        <header
          className={[
            "flex flex-wrap items-start justify-between gap-4",
            showDebugOutlines
              ? "relative outline outline-1 outline-dashed outline-blue-300/80"
              : "",
          ].join(" ")}
        >
          {showDebugOutlines ? (
            <span className="absolute -top-3 left-2 rounded bg-blue-100 px-1 text-[10px] font-semibold text-blue-800">
              HEADER
            </span>
          ) : null}
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="text-blue-700">Roadmap</span>{" "}
              <span className="text-slate-900 dark:text-slate-100">to</span>{" "}
              <span className="text-red-600">Liberty</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isUnplanned
                ? "Review unplanned work items that need dates."
                : "Visualize roadmap ideas across pillars, time, and regions."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={getToggleViewHref(isUnplanned)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isUnplanned ? "Back to roadmap" : "Unplanned work"}
            </Link>
            <SignedIn>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Roadmap
                </span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  value={selectedRoadmapValue}
                  onChange={(e) => handleRoadmapSelect(e.target.value)}
                >
                  <option value="">Select roadmap</option>
                  {roadmapOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <details
                  className="relative"
                  open={isRoadmapManageOpen}
                  onToggle={(event) =>
                    setIsRoadmapManageOpen(
                      (event.target as HTMLDetailsElement).open
                    )
                  }
                >
                  <summary className="list-none rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 cursor-pointer hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800">
                    Manage
                  </summary>
                  <div className="absolute right-0 z-[120] mt-2 w-[28rem] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <RoadmapManagerPanel
                          isLoading={isLoadingRoadmaps}
                          roadmaps={roadmaps}
                          currentUserId={userId ?? null}
                          activeRoadmapId={activeRoadmapId}
                          shareRoadmapId={shareRoadmapId}
                          onShareRoadmapClose={() => setShareRoadmapId(null)}
                          onLoadRoadmap={handleLoadRoadmap}
                          onCreateRoadmap={handleCreateRoadmap}
                          onRenameRoadmap={handleRenameRoadmap}
                          onDeleteRoadmap={handleDeleteRoadmap}
                          onShareUser={handleShareRoadmapUser}
                          onUpdateShare={handleUpdateRoadmapShare}
                          onRevokeShare={handleRevokeRoadmapShare}
                          variant="plain"
                        />
                  </div>
                </details>
              </div>
            </SignedIn>
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
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-8 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900/70 dark:to-slate-950">
            <div className="max-w-2xl space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Tech Roadmap Viewer
              </div>
              <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-slate-100">
                Sign in to view and manage roadmaps.
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Use your organization account to access your saved roadmaps,
                manage sharing, and keep timelines aligned.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    Sign in
                  </button>
                </SignInButton>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  You can still browse the demo data while signed out.
                </span>
              </div>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          {isLoadingRoadmaps ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Loading roadmaps...
            </div>
          ) : null}
          {activeRoadmapId && showDebugOutlines ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  Datasource debug
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-300 px-3 py-1 text-[0.7rem] text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={async () => {
                    if (!activeRoadmapId) return;
                    const items = await fetchDatasourceItems(activeRoadmapId, true);
                    if (items) applyRoadmapItems(items);
                  }}
                >
                  Refresh datasource
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">
                    Type
                  </span>
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {activeDatasourceType ?? "csv"}
                  </div>
                </div>
                <div>
                  <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">
                    Items
                  </span>
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {datasourceDebug?.count ?? items.length}
                  </div>
                </div>
                {datasourceDebug?.warning ? (
                  <div className="sm:col-span-2 text-[0.7rem] text-amber-600 dark:text-amber-300">
                    {datasourceDebug.warning}
                  </div>
                ) : null}
                {datasourceDebug?.error ? (
                  <div className="sm:col-span-2 text-[0.7rem] text-rose-600 dark:text-rose-300">
                    {datasourceDebug.error}
                  </div>
                ) : null}
                {datasourceDebug?.stale ? (
                  <div className="sm:col-span-2 text-[0.7rem] text-slate-500 dark:text-slate-400">
                    Showing cached data.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {!isLoadingRoadmaps && roadmaps.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <div className="space-y-2">
                <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Create your first roadmap
                </div>
                <p>
                  You don’t have any roadmaps yet. Create one to start adding
                  items or import a CSV.
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    setIsRoadmapManageOpen(true);
                    if (typeof window !== "undefined") {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  Open Roadmap Manager
                </button>
              </div>
            </div>
          ) : null}
          {!isLoadingRoadmaps && roadmaps.length > 0 ? (
            <div
              className={[
                "space-y-3",
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
                  ? "relative outline outline-1 outline-dashed outline-sky-300/80"
                  : "",
              ].join(" ")}
            >
              {showDebugOutlines ? (
                <span className="absolute -top-3 left-2 rounded bg-sky-100 px-1 text-[10px] font-semibold text-sky-800">
                  CONTROLS
                </span>
              ) : null}
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
              <div
                className="flex flex-wrap items-center gap-3"
                style={{
                  marginLeft: isHeaderCollapsed ? 0 : "calc(20rem + 1.5rem)",
                }}
              >
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      View
                    </span>
                    <select
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      value={selectedViewValue}
                      onChange={(e) => handleViewSelect(e.target.value)}
                    >
                      <option value="">Select view</option>
                      {viewOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <details className="relative">
                      <summary className="list-none rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 cursor-pointer hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800">
                        Manage
                      </summary>
                      <div className="absolute left-0 z-[120] mt-2 w-96 max-w-[90vw] rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <SavedViewsPanel
                          isLoading={isLoadingViews}
                          views={views}
                          shareBaseUrl={shareBaseUrl}
                          onSaveView={handleSaveView}
                          onLoadView={handleLoadView}
                          onRenameView={handleRenameView}
                          onDeleteView={handleDeleteView}
                          onCreateLink={handleCreateLink}
                          onDeleteLink={handleDeleteLink}
                          onUpdateView={handleUpdateView}
                          activeViewId={loadedView?.id ?? null}
                          variant="plain"
                        />
                      </div>
                    </details>
                  </div>
                  <button
                    type="button"
                    className={[
                      "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
                    ].join(" ")}
                    onClick={() => {
                      if (activeRoadmapId) {
                        setShareRoadmapId(activeRoadmapId);
                      }
                    }}
                    disabled={
                      !activeRoadmapId ||
                      !activeRoadmapRole ||
                      activeRoadmapRole === "viewer"
                    }
                    title="Share current roadmap"
                  >
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
                        <circle cx="18" cy="5" r="2" />
                        <circle cx="6" cy="12" r="2" />
                        <circle cx="18" cy="19" r="2" />
                        <path d="M8 12l8-6" />
                        <path d="M8 12l8 6" />
                      </svg>
                    </span>
                    Share roadmap
                  </button>
                </div>
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
                "relative flex gap-6",
                showDebugOutlines
                  ? "outline outline-1 outline-dashed outline-emerald-300/80"
                  : "",
              ].join(" ")}
            >
              {showDebugOutlines ? (
                <span className="absolute -top-3 left-2 rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-800">
                  LAYOUT
                </span>
              ) : null}
              {isHeaderCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsHeaderCollapsed(false)}
                  className="absolute top-6 left-0 -translate-x-1/2 rounded-full border bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Expand controls"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 6l6 6-6 6" />
                    <path d="M14 6l6 6-6 6" />
                  </svg>
                </button>
              ) : null}
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
                {showDebugOutlines && !isHeaderCollapsed ? (
                  <span className="absolute -top-3 left-2 rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-800">
                    DRAWER
                  </span>
                ) : null}
                <div className="sticky top-6 space-y-4">
                  {isHeaderCollapsed ? null : (
                      <RoadmapFilters
                        items={items}
                        selectedPillars={selectedPillars}
                        setSelectedPillars={setSelectedPillars}
                      selectedRegions={selectedRegions}
                      setSelectedRegions={setSelectedRegions}
                      selectedCriticalities={selectedCriticalities}
                      setSelectedCriticalities={setSelectedCriticalities}
                      selectedDispositions={selectedDispositions}
                      setSelectedDispositions={setSelectedDispositions}
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
                        showDebugOutlines={showDebugOutlines}
                        isCollapsed={false}
                        onToggleCollapsed={() => setIsHeaderCollapsed(true)}
                      />
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
                {isUnplanned ? (
                  <UnplannedList
                    items={unplannedItems}
                    groupBy={selectedGroupBy}
                    showShortDescription={displayOptions.showShortDescription}
                    exportSummary={{
                      viewBy: summaryViewBy,
                      titlePrefix,
                      filters: appliedFilters,
                    }}
                    isExporting={isExporting}
                    showDebugOutlines={showDebugOutlines}
                  />
                ) : (
                  <RoadmapTimeline
                    items={plannedItems}
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
                )}
              </div>
            </div>
            </div>
          ) : null}
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

function hasValidTimelineDates(item: RoadmapItem): boolean {
  return isValidDateValue(item.startDate) && isValidDateValue(item.endDate);
}

function isValidDateValue(value: string): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function getToggleViewHref(isUnplanned: boolean): string {
  const basePath = isUnplanned ? "/" : "/unplanned";
  if (typeof window === "undefined") return basePath;
  const params = new URLSearchParams(window.location.search);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

