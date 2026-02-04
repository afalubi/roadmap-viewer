"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { CapacityView } from "@/components/roadmap/CapacityView";
import { RoadmapManagerPanel } from "@/components/roadmap/RoadmapManagerPanel";
import { AdminPanel } from "@/components/roadmap/AdminPanel";
import { SavedViewsPanel } from "@/components/roadmap/SavedViewsPanel";
import {
  RoadmapItemNotesDialog,
  type RoadmapItemNote,
} from "@/components/roadmap/RoadmapItemNotesDialog";
import {
  RoadmapItemRelatedDialog,
  type RoadmapItemRelated,
} from "@/components/roadmap/RoadmapItemRelatedDialog";
import type { RoadmapDetail, RoadmapSummary } from "@/types/roadmaps";
import type { RoadmapThemeConfig } from "@/types/theme";
import type { UserRoles } from "@/types/users";
import type {
  DisplayOptions,
  GroupByOption,
  SavedView,
  ThemeOption,
  ViewPayload,
} from "@/types/views";

type RoadmapPageMode = "planned" | "unplanned" | "capacity";

export function RoadmapPage({ mode }: { mode: RoadmapPageMode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const lastUserIdRef = useRef<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
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
  const [selectedPrimaryStakeholders, setSelectedPrimaryStakeholders] =
    useState<string[]>([]);
  const [selectedImpactedStakeholders, setSelectedImpactedStakeholders] =
    useState<string[]>([]);
  const [selectedGroupBy, setSelectedGroupBy] =
    useState<GroupByOption>("pillar");
  const defaultDisplayOptions: DisplayOptions = {
    showRegionEmojis: true,
    showShortDescription: true,
    showConvention: false,
    titleAbove: false,
    itemVerticalPadding: 6,
    laneDividerOpacity: 0.12,
    itemStyle: "tile" as "tile" | "line",
    lineTitleGap: 2,
    showQuarters: true,
    showMonths: false,
    showDynamicHeader: true,
    darkMode: false,
    showBoldProjectBorders: true,
    boldProjectBorderColor: "#334155",
    boldProjectBorderAlternateColor: "#ffffff",
  };
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(
    defaultDisplayOptions
  );
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>("executive");
  const [roadmapThemeConfig, setRoadmapThemeConfig] =
    useState<RoadmapThemeConfig | null>(null);
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
  const [isRefreshingDatasource, setIsRefreshingDatasource] = useState(false);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [showDebugOutlines, setShowDebugOutlines] = useState(false);
  const [shareBaseUrl, setShareBaseUrl] = useState("");
  const [exportPageSize, setExportPageSize] = useState<"letter" | "legal">(
    "letter"
  );
  const [unplannedLayout, setUnplannedLayout] = useState<"list" | "board">(
    "list"
  );
  const [fullWidth, setFullWidth] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [isLoadingRoadmaps, setIsLoadingRoadmaps] = useState(false);
  const [isRoadmapMenuOpen, setIsRoadmapMenuOpen] = useState(false);
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
  const [isDebugItemsOpen, setIsDebugItemsOpen] = useState(false);
  const [isDebugItemsLoading, setIsDebugItemsLoading] = useState(false);
  const [debugItemsPayload, setDebugItemsPayload] = useState<RoadmapItem[] | null>(
    null
  );
  const [loadedSharedSlug, setLoadedSharedSlug] = useState("");
  const [isSharedViewActive, setIsSharedViewActive] = useState(false);
  const [sharedViewSlug, setSharedViewSlug] = useState("");
  const [viewPasswordPrompt, setViewPasswordPrompt] = useState<{
    slug: string;
    error?: string | null;
  } | null>(null);
  const [viewPasswordInput, setViewPasswordInput] = useState("");
  const [isViewPasswordLoading, setIsViewPasswordLoading] = useState(false);
  const [isSharedViewPending, setIsSharedViewPending] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [isRoadmapManageOpen, setIsRoadmapManageOpen] = useState(false);
  const [shareRoadmapId, setShareRoadmapId] = useState<string | null>(null);
  const [loadedView, setLoadedView] = useState<SavedView | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [viewMode, setViewMode] = useState<RoadmapPageMode>(mode);
  const [capacityBucketSize, setCapacityBucketSize] = useState<
    "week" | "quarter"
  >("week");
  const [capacityRoles, setCapacityRoles] = useState<Array<"lead" | "sme">>([
    "lead",
    "sme",
  ]);
  const [userRoles, setUserRoles] = useState<UserRoles | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const isAdmin = Boolean(userRoles?.isSystemAdmin);
  const canViewCapacity = Boolean(
    userRoles?.isSystemAdmin || userRoles?.canViewCapacity
  );
  const canEditTitle =
    !isSharedViewActive &&
    Boolean(activeRoadmapRole) &&
    activeRoadmapRole !== "viewer";
  const canViewNotes =
    !isSharedViewActive &&
    Boolean(activeRoadmapRole) &&
    activeRoadmapRole !== "viewer" &&
    activeDatasourceType === "azure-devops";
  const canViewRelated = canViewNotes;
  const [notesItem, setNotesItem] = useState<RoadmapItem | null>(null);
  const [notes, setNotes] = useState<RoadmapItemNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const notesCacheRef = useRef<Record<string, RoadmapItemNote[]>>({});
  const [notesReadyMap, setNotesReadyMap] = useState<Record<string, boolean>>({});
  const notesReadyRef = useRef<Record<string, boolean>>({});
  const notesInFlightRef = useRef<Record<string, boolean>>({});

  const [relatedItem, setRelatedItem] = useState<RoadmapItem | null>(null);
  const [relatedGroups, setRelatedGroups] = useState<
    Array<{ state: string; items: RoadmapItemRelated[] }>
  >([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const relatedCacheRef = useRef<Record<string, RoadmapItemRelated[]>>({});
  const [relatedReadyMap, setRelatedReadyMap] = useState<Record<string, boolean>>({});
  const relatedReadyRef = useRef<Record<string, boolean>>({});
  const relatedInFlightRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setNotesItem(null);
    setNotes([]);
    setNotesError(null);
    setNotesLoading(false);
    notesCacheRef.current = {};
    setNotesReadyMap({});
    notesReadyRef.current = {};
    notesInFlightRef.current = {};

    setRelatedItem(null);
    setRelatedGroups([]);
    setRelatedError(null);
    setRelatedLoading(false);
    relatedCacheRef.current = {};
    setRelatedReadyMap({});
    relatedReadyRef.current = {};
    relatedInFlightRef.current = {};
  }, [activeRoadmapId]);

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
    if (typeof window === "undefined") return;
    setHasMounted(true);
    const params = new URLSearchParams(window.location.search);
    const hasParam = Boolean(params.get("view"));
    const hasStored = Boolean(window.sessionStorage.getItem("sharedViewSlug"));
    if (hasParam || hasStored) {
      setIsSharedViewPending(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    const nextMode =
      modeParam === "unplanned"
        ? "unplanned"
        : modeParam === "capacity" && canViewCapacity
          ? "capacity"
          : "planned";
    setViewMode(nextMode);
  }, [canViewCapacity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get("mode");
      const nextMode =
        modeParam === "unplanned"
          ? "unplanned"
          : modeParam === "capacity" && canViewCapacity
            ? "capacity"
            : "planned";
      setViewMode(nextMode);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [canViewCapacity]);

  useEffect(() => {
    if (!isLoaded) return;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("roadmapId") || params.get("view")) {
        return;
      }
    }
    if (!isSignedIn) {
      if (!isOnline) return;
      setIsItemsLoading(true);
      loadRoadmap()
        .then((data) => {
          setItems(data);
          setFilteredItems(data);
        })
        .catch(() => {
          setItems([]);
          setFilteredItems([]);
        })
        .finally(() => setIsItemsLoading(false));
    }
  }, [isLoaded, isSignedIn, isOnline]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUserRoles(null);
      return;
    }
    if (!isOnline) return;
    let active = true;
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { roles?: UserRoles } };
        if (!active) return;
        setUserRoles(data.user?.roles ?? null);
      } catch {
        if (active) {
          setUserRoles(null);
        }
      }
    };
    fetchMe();
    return () => {
      active = false;
    };
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
    setIsHydrated(false);
    setSettingsKey(`roadmap-viewer-settings:${tabId}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getScrollStorageKey(viewMode);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: value, behavior: "auto" });
    });
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setShowDebugOutlines(params.get("debug") === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("view") ?? "";
    if (slug) {
      window.sessionStorage.setItem("sharedViewSlug", slug);
      setSharedViewSlug(slug);
      return;
    }
    const stored = window.sessionStorage.getItem("sharedViewSlug") ?? "";
    setSharedViewSlug(stored);
    if (stored && !params.get("viewId") && !params.get("roadmapId")) {
      params.set("view", stored);
      const nextUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShareBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-dropdown]")) return;
      document.querySelectorAll("details[data-dropdown][open]").forEach((el) => {
        (el as HTMLDetailsElement).open = false;
      });
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
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
      primaryStakeholders: selectedPrimaryStakeholders,
      impactedStakeholders: selectedImpactedStakeholders,
    },
    mode: viewMode,
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
    capacity: {
      bucketSize: capacityBucketSize,
      roles: capacityRoles,
    },
  });

  const applyViewPayload = (payload: ViewPayload) => {
    setSelectedPillars(payload.filters?.pillars ?? []);
    setSelectedRegions(payload.filters?.regions ?? []);
    setSelectedCriticalities(payload.filters?.criticalities ?? []);
    setSelectedDispositions(payload.filters?.dispositions ?? []);
    setSelectedPrimaryStakeholders(payload.filters?.primaryStakeholders ?? []);
    setSelectedImpactedStakeholders(
      payload.filters?.impactedStakeholders ?? []
    );
    if (payload.mode) {
      const nextMode =
        payload.mode === "capacity" && !canViewCapacity
          ? "planned"
          : payload.mode;
      setViewMode(nextMode);
      if (typeof window !== "undefined") {
        const nextUrl = new URL(window.location.href);
        if (nextMode === "unplanned") {
          nextUrl.searchParams.set("mode", "unplanned");
        } else if (nextMode === "capacity") {
          nextUrl.searchParams.set("mode", "capacity");
        } else {
          nextUrl.searchParams.delete("mode");
        }
        window.history.replaceState(null, "", nextUrl.toString());
      }
    }
    if (payload.display?.groupBy) {
      setSelectedGroupBy(payload.display.groupBy);
    }
    if (payload.display?.theme) {
      setSelectedTheme(payload.display.theme);
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
    if (payload.capacity?.bucketSize) {
      setCapacityBucketSize(payload.capacity.bucketSize);
    }
    if (payload.capacity?.roles) {
      setCapacityRoles(payload.capacity.roles);
    }
  };

  const handleLoadView = async (view: SavedView) => {
    if (view.roadmapId && view.roadmapId !== activeRoadmapId) {
      await loadRoadmapById(view.roadmapId);
    }
    applyViewPayload(view.payload);
    setLoadedView(view);
    setIsSharedViewActive(false);
    setLoadedSharedSlug("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("sharedViewSlug");
    }
    setSharedViewSlug("");
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("viewId", view.id);
      nextUrl.searchParams.delete("view");
      if (view.roadmapId) {
        nextUrl.searchParams.set("roadmapId", view.roadmapId);
        nextUrl.searchParams.delete("roadmap");
      }
      window.history.replaceState(null, "", nextUrl.toString());
    }
  };

  const shiftQuarter = (delta: number) => {
    const [year, month, day] = startDate.split("-").map(Number);
    const base = year && month
      ? new Date(Date.UTC(year, month - 1, day || 1))
      : new Date();
    const shifted = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + delta * 3, 1),
    );
    const aligned = getQuarterStartDate(shifted);
    setStartDate(formatDateInput(aligned));
  };

  const getQuarterOffset = () => {
    const [year, month, day] = startDate.split("-").map(Number);
    const base = year && month
      ? new Date(Date.UTC(year, month - 1, day || 1))
      : new Date();
    const aligned = getQuarterStartDate(base);
    const nowAligned = getQuarterStartDate(new Date());
    const diffMonths =
      (aligned.getUTCFullYear() - nowAligned.getUTCFullYear()) * 12 +
      (aligned.getUTCMonth() - nowAligned.getUTCMonth());
    return Math.round(diffMonths / 3);
  };

  const setQuarterOffset = (offset: number) => {
    const nowAligned = getQuarterStartDate(new Date());
    const shifted = new Date(
      Date.UTC(
        nowAligned.getUTCFullYear(),
        nowAligned.getUTCMonth() + offset * 3,
        1,
      ),
    );
    setStartDate(formatDateInput(shifted));
  };
  const clearActiveView = () => {
    setLoadedView(null);
    setIsSharedViewActive(false);
    setLoadedSharedSlug("");
    setSharedViewSlug("");
    setIsSharedViewPending(false);
    setViewPasswordPrompt(null);
    setViewPasswordInput("");
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("viewId");
      nextUrl.searchParams.delete("view");
      window.history.replaceState(null, "", nextUrl.toString());
      window.sessionStorage.removeItem("sharedViewSlug");
    }
  };

  const handleExitSharedView = () => {
    if (typeof window !== "undefined") {
      const slugParam = new URLSearchParams(window.location.search).get("view") ?? "";
      const slug = loadedSharedSlug || sharedViewSlug || slugParam;
      if (slug) {
        window.sessionStorage.removeItem(`view-link-password:${slug}`);
      }
    }
    clearActiveView();
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
        const hasSharedLink =
          typeof window !== "undefined" &&
          (new URLSearchParams(window.location.search).get("view") ||
            window.sessionStorage.getItem("sharedViewSlug"));
        if (isSharedViewActive || hasSharedLink) {
          return;
        }
        setActiveRoadmapId(null);
        setActiveRoadmapRole(null);
        setActiveDatasourceType(null);
        setViews([]);
        setLoadedView(null);
        setIsSharedViewActive(false);
        setLoadedSharedSlug("");
        setSharedViewSlug("");
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
    setIsItemsLoading(false);
    notesCacheRef.current = {};
    notesReadyRef.current = {};
    notesInFlightRef.current = {};
    setNotesReadyMap({});
    relatedCacheRef.current = {};
    relatedReadyRef.current = {};
    relatedInFlightRef.current = {};
    setRelatedReadyMap({});
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
    setIsItemsLoading(true);
    try {
      const res = await fetch(`/api/roadmaps/${roadmapId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { roadmap?: RoadmapDetail };
      if (data.roadmap) {
        setTitlePrefix(data.roadmap.displayTitle ?? data.roadmap.name);
        setRoadmapThemeConfig(data.roadmap.themeConfig ?? null);
        if (data.roadmap.themeConfig?.baseTheme) {
          setSelectedTheme(data.roadmap.themeConfig.baseTheme);
        }
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
    } finally {
      setIsItemsLoading(false);
    }
  };


  const handleLoadRoadmap = async (roadmap: RoadmapSummary) => {
    if (typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("roadmapId", roadmap.id);
      nextUrl.searchParams.delete("roadmap");
      nextUrl.searchParams.delete("viewId");
      nextUrl.searchParams.delete("view");
      window.history.replaceState(null, "", nextUrl.toString());
    }
    setLoadedView(null);
    setLoadedSharedSlug("");
    setIsSharedViewActive(false);
    setSharedViewSlug("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("sharedViewSlug");
    }
    setShareRoadmapId(null);
    await loadRoadmapById(roadmap.id);
  };

  const fetchViews = async () => {
    if (!isSignedIn) {
      setViews([]);
      return;
    }
    if (isSharedViewActive) {
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
      if (res.status === 403) {
        return;
      }
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
      setIsSharedViewActive(false);
      setLoadedSharedSlug("");
      const nextUrl = new URL(window.location.href);
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
      body: JSON.stringify(options ?? {}),
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
      setTitlePrefix(name);
      applyCsvText(csvText);
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
    const updatedAt = new Date().toISOString();
    setRoadmaps((current) =>
      current.map((roadmap) =>
        roadmap.id === id
          ? { ...roadmap, name, updatedAt }
          : roadmap
      )
    );
    return true;
  };

  const commitTitleEdit = async () => {
    const nextTitle = titleDraft.trim();
    const previousTitle = titlePrefix;
    if (!nextTitle) {
      setTitleDraft(previousTitle);
      setIsEditingTitle(false);
      return;
    }
    if (!canEditTitle) {
      setTitleDraft(previousTitle);
      setIsEditingTitle(false);
      return;
    }
    if (nextTitle === previousTitle) {
      setIsEditingTitle(false);
      return;
    }
    setTitlePrefix(nextTitle);
    setTitleDraft(nextTitle);
    setIsEditingTitle(false);
    if (activeRoadmapId) {
      const ok = await handleUpdateRoadmapTitle(activeRoadmapId, nextTitle);
      if (!ok) {
        setTitlePrefix(previousTitle);
        setTitleDraft(previousTitle);
      }
    }
  };

  const handleUpdateRoadmapTitle = async (id: string, displayTitle: string) => {
    if (!isSignedIn) return false;
    if (!isOnline) return false;
    const res = await fetch(`/api/roadmaps/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayTitle }),
    });
    return res.ok;
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

  const handleOpenNotes = async (item: RoadmapItem) => {
    if (!activeRoadmapId) return;
    if (!canViewNotes) return;
    const cached = notesCacheRef.current[item.id];
    setNotesItem(item);
    if (cached) {
      setNotes(cached);
      setNotesError(null);
      setNotesLoading(false);
      return;
    }
    setNotes([]);
    setNotesError(null);
    setNotesLoading(true);
    try {
      const res = await fetch(
        `/api/roadmaps/${activeRoadmapId}/notes/${encodeURIComponent(item.id)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNotesError(data?.error ?? "Unable to load notes.");
        return;
      }
      const data = (await res.json()) as { comments?: RoadmapItemNote[] };
      const nextNotes = Array.isArray(data.comments) ? data.comments : [];
      setNotes(nextNotes);
      notesCacheRef.current = {
        ...notesCacheRef.current,
        [item.id]: nextNotes,
      };
      notesReadyRef.current = { ...notesReadyRef.current, [item.id]: true };
      notesInFlightRef.current = { ...notesInFlightRef.current, [item.id]: false };
      setNotesReadyMap((current) =>
        current[item.id] === true ? current : { ...current, [item.id]: true }
      );
    } catch {
      setNotesError("Unable to load notes.");
    } finally {
      setNotesLoading(false);
    }
  };

  const handleCloseNotes = () => {
    setNotesItem(null);
    setNotes([]);
    setNotesError(null);
    setNotesLoading(false);
  };

  const groupRelatedByState = (items: RoadmapItemRelated[]) => {
    const ORDER = ['Active', 'New', 'Testing', 'Completed', 'Removed'];
    const normalizeGroup = (state: string) => {
      const trimmed = state.trim().toLowerCase();
      if (trimmed === 'active') return 'Active';
      if (trimmed === 'new') return 'New';
      if (trimmed === 'resolved') return 'Testing';
      if (trimmed === 'closed') return 'Completed';
      if (trimmed === 'removed') return 'Removed';
      return 'Other';
    };
    const groups = new Map<string, RoadmapItemRelated[]>();
    items.forEach((item) => {
      const key = normalizeGroup(item.state || 'Other');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
      const aIndex = ORDER.includes(a) ? ORDER.indexOf(a) : ORDER.length;
      const bIndex = ORDER.includes(b) ? ORDER.indexOf(b) : ORDER.length;
      return aIndex - bIndex;
    });
    return sortedGroups.map(([state, groupItems]) => ({
      state,
      items: [...groupItems].sort((a, b) => {
        const aDate = a.createdDate ? Date.parse(a.createdDate) : 0;
        const bDate = b.createdDate ? Date.parse(b.createdDate) : 0;
        return bDate - aDate;
      }),
    }));
  };

  const handleOpenRelated = async (item: RoadmapItem) => {
    if (!activeRoadmapId) return;
    if (!canViewRelated) return;
    const cached = relatedCacheRef.current[item.id];
    setRelatedItem(item);
    if (cached) {
      relatedReadyRef.current = { ...relatedReadyRef.current, [item.id]: true };
      setRelatedReadyMap((current) =>
        current[item.id] === true ? current : { ...current, [item.id]: true }
      );
      setRelatedGroups(groupRelatedByState(cached));
      setRelatedError(null);
      setRelatedLoading(false);
      return;
    }
    setRelatedGroups([]);
    setRelatedError(null);
    setRelatedLoading(true);
    try {
      const res = await fetch(
        `/api/roadmaps/${activeRoadmapId}/related/${encodeURIComponent(item.id)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRelatedError(data?.error ?? 'Unable to load related items.');
        return;
      }
      const data = (await res.json()) as { related?: RoadmapItemRelated[] };
      const nextRelated = Array.isArray(data.related) ? data.related : [];
      relatedCacheRef.current = {
        ...relatedCacheRef.current,
        [item.id]: nextRelated,
      };
      relatedReadyRef.current = { ...relatedReadyRef.current, [item.id]: true };
      relatedInFlightRef.current = { ...relatedInFlightRef.current, [item.id]: false };
      setRelatedReadyMap((current) =>
        current[item.id] === true ? current : { ...current, [item.id]: true }
      );
      setRelatedGroups(groupRelatedByState(nextRelated));
    } catch {
      setRelatedError('Unable to load related items.');
    } finally {
      setRelatedLoading(false);
    }
  };

  const handlePrefetchRelated = useCallback(
    async (item: RoadmapItem) => {
      if (!activeRoadmapId) return;
      if (!canViewRelated) return;
      if (!isOnline) return;
      if (relatedCacheRef.current[item.id]) return;
      if (relatedInFlightRef.current[item.id]) return;
      if (relatedReadyRef.current[item.id] === false) return;
      relatedInFlightRef.current = {
        ...relatedInFlightRef.current,
        [item.id]: true,
      };
      relatedReadyRef.current = { ...relatedReadyRef.current, [item.id]: false };
      setRelatedReadyMap((current) =>
        current[item.id] === false ? current : { ...current, [item.id]: false }
      );
      try {
        const res = await fetch(
          `/api/roadmaps/${activeRoadmapId}/related/${encodeURIComponent(item.id)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { related?: RoadmapItemRelated[] };
        const nextRelated = Array.isArray(data.related) ? data.related : [];
        relatedCacheRef.current = {
          ...relatedCacheRef.current,
          [item.id]: nextRelated,
        };
        relatedReadyRef.current = { ...relatedReadyRef.current, [item.id]: true };
        relatedInFlightRef.current = {
          ...relatedInFlightRef.current,
          [item.id]: false,
        };
        setRelatedReadyMap((current) =>
          current[item.id] === true ? current : { ...current, [item.id]: true }
        );
      } catch {
        // Ignore prefetch errors.
      } finally {
        relatedInFlightRef.current = {
          ...relatedInFlightRef.current,
          [item.id]: false,
        };
        if (!relatedCacheRef.current[item.id]) {
          relatedReadyRef.current = { ...relatedReadyRef.current, [item.id]: true };
          setRelatedReadyMap((current) =>
            current[item.id] === true ? current : { ...current, [item.id]: true }
          );
        }
      }
    },
    [activeRoadmapId, canViewRelated, isOnline],
  );

  const handleCloseRelated = () => {
    setRelatedItem(null);
    setRelatedGroups([]);
    setRelatedError(null);
    setRelatedLoading(false);
  };
  const handlePrefetchNotes = useCallback(async (item: RoadmapItem) => {
    if (!activeRoadmapId) return;
    if (!canViewNotes) return;
    if (!isOnline) return;
    if (notesCacheRef.current[item.id]) return;
    if (notesInFlightRef.current[item.id]) return;
    if (notesReadyRef.current[item.id] === false) return;
    notesInFlightRef.current = { ...notesInFlightRef.current, [item.id]: true };
    notesReadyRef.current = { ...notesReadyRef.current, [item.id]: false };
    setNotesReadyMap((current) =>
      current[item.id] === false ? current : { ...current, [item.id]: false }
    );
    try {
      const res = await fetch(
        `/api/roadmaps/${activeRoadmapId}/notes/${encodeURIComponent(item.id)}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { comments?: RoadmapItemNote[] };
      const nextNotes = Array.isArray(data.comments) ? data.comments : [];
      notesCacheRef.current = {
        ...notesCacheRef.current,
        [item.id]: nextNotes,
      };
      notesReadyRef.current = { ...notesReadyRef.current, [item.id]: true };
      notesInFlightRef.current = { ...notesInFlightRef.current, [item.id]: false };
      setNotesReadyMap((current) =>
        current[item.id] === true ? current : { ...current, [item.id]: true }
      );
    } catch {
      // Ignore prefetch errors.
    } finally {
      notesInFlightRef.current = { ...notesInFlightRef.current, [item.id]: false };
      if (!notesCacheRef.current[item.id]) {
        notesReadyRef.current = { ...notesReadyRef.current, [item.id]: true };
        setNotesReadyMap((current) =>
          current[item.id] === true ? current : { ...current, [item.id]: true }
        );
      }
    }
  }, [activeRoadmapId, canViewNotes, isOnline]);

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
    if (lastUserIdRef.current !== userId) {
      lastUserIdRef.current = userId ?? null;
      setIsLoadingRoadmaps(true);
      setRoadmaps([]);
      setActiveRoadmapId(null);
      setActiveRoadmapRole(null);
      setActiveDatasourceType(null);
      setViews([]);
      setLoadedView(null);
      setIsSharedViewActive(false);
      setLoadedSharedSlug("");
      setFilteredItems([]);
      setItems([]);
    }
  }, [isLoaded, userId]);


  useEffect(() => {
    if (!isLoaded) return;
    if (typeof window === "undefined") return;
    if (!isOnline) return;
    if (isSharedViewActive || isSharedViewPending) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view")) return;
    const roadmapIdParam = params.get("roadmapId") ?? "";

    if (isSignedIn && roadmapIdParam && roadmapIdParam !== activeRoadmapId) {
      loadRoadmapById(roadmapIdParam);
      return;
    }
    if (isSignedIn && !activeRoadmapId && roadmaps.length > 0) {
      const canAutoLoad =
        userRoles?.isSystemAdmin ||
        userRoles?.canCreateRoadmaps ||
        roadmaps.some((roadmap) => roadmap.role === "owner" || roadmap.role === "editor");
      if (!canAutoLoad) {
        return;
      }
      const preferred =
        roadmaps.find((roadmap) => roadmap.role === "owner") ??
        roadmaps.find((roadmap) => roadmap.role === "editor") ??
        roadmaps[0];
      handleLoadRoadmap(preferred);
    }
  }, [
    isLoaded,
    isSignedIn,
    activeRoadmapId,
    roadmaps,
    isOnline,
    userRoles,
    isSharedViewActive,
    isSharedViewPending,
  ]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get("viewId") ?? "";
    if (!viewId || loadedView?.id === viewId) return;
    if (
      typeof window !== "undefined" &&
      activeRoadmapId &&
      params.get("roadmapId") &&
      params.get("roadmapId") !== activeRoadmapId
    ) {
      return;
    }
    const match = views.find((view) => view.id === viewId);
    if (!match) return;
    handleLoadView(match);
  }, [isSignedIn, views, loadedView?.id]);

  const getStoredViewPassword = (slug: string) => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(`view-link-password:${slug}`) ?? null;
  };

  const setStoredViewPassword = (slug: string, password: string | null) => {
    if (typeof window === "undefined") return;
    const key = `view-link-password:${slug}`;
    if (!password) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, password);
  };

  const loadSharedViewBySlug = async (
    slug: string,
    password?: string | null
  ) => {
    try {
      const res = await fetch(`/api/views/slug/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password ?? null }),
      });
      if (res.status === 401) {
        const data = await res.json().catch(() => null);
        return {
          status: "password" as const,
          error: data?.error ?? "Password required",
        };
      }
      if (!res.ok) {
        return { status: "error" as const };
      }
      const data = await res.json();
      if (Array.isArray(data.view?.items)) {
        const nextItems = data.view.items as RoadmapItem[];
        applyRoadmapItems(nextItems);
        setDatasourceDebug({
          count: nextItems.length,
          stale: false,
          truncated: false,
          warning: null,
          error: null,
        });
      } else if (typeof data.view?.roadmapCsvText === "string") {
        applyCsvText(data.view.roadmapCsvText as string);
      }
      if (data.view?.payload) {
        applyViewPayload(data.view.payload as ViewPayload);
      }
      if (data.view) {
        setLoadedView(data.view as SavedView);
        setIsSharedViewActive(true);
        setSharedViewSlug(slug);
        setIsHeaderCollapsed(true);
        if (data.view.roadmapId) {
          setActiveRoadmapId(data.view.roadmapId as string);
          setActiveRoadmapRole("viewer");
        }
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("sharedViewSlug", slug);
      }
      setLoadedSharedSlug(slug);
      if (password) {
        setStoredViewPassword(slug, password);
      }
      return { status: "ok" as const };
    } catch {
      return { status: "error" as const };
    }
  };

  const clearSharedView = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("sharedViewSlug");
      const params = new URLSearchParams(window.location.search);
      params.delete("view");
      const nextUrl = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      window.history.replaceState(null, "", nextUrl);
    }
    setSharedViewSlug("");
    setLoadedSharedSlug("");
    setIsSharedViewActive(false);
    setIsSharedViewPending(false);
    setViewPasswordPrompt(null);
    setViewPasswordInput("");
    setLoadedView(null);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOnline) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("view") ?? "";
    if (!slug || slug === loadedSharedSlug) {
      if (!slug) {
        setIsSharedViewPending(false);
      }
      return;
    }

    const storedPassword = getStoredViewPassword(slug);
    setIsSharedViewPending(true);
    loadSharedViewBySlug(slug, storedPassword).then((result) => {
      if (result.status === "password") {
        if (storedPassword) {
          setStoredViewPassword(slug, null);
        }
        setViewPasswordPrompt({ slug, error: result.error });
        setViewPasswordInput("");
      }
      setIsSharedViewPending(false);
    });
  }, [loadedSharedSlug, isOnline]);

  const handleViewPasswordSubmit = async () => {
    if (!viewPasswordPrompt) return;
    const password = viewPasswordInput.trim();
    if (!password) {
      setViewPasswordPrompt({
        slug: viewPasswordPrompt.slug,
        error: "Password required",
      });
      return;
    }
    setIsViewPasswordLoading(true);
    setIsSharedViewPending(true);
    const result = await loadSharedViewBySlug(viewPasswordPrompt.slug, password);
    setIsViewPasswordLoading(false);
    setIsSharedViewPending(false);
    if (result.status === "ok") {
      setViewPasswordPrompt(null);
      setViewPasswordInput("");
      return;
    }
    if (result.status === "password") {
      setViewPasswordPrompt({
        slug: viewPasswordPrompt.slug,
        error: result.error ?? "Invalid password",
      });
      return;
    }
    setViewPasswordPrompt({
      slug: viewPasswordPrompt.slug,
      error: "Unable to load view.",
    });
  };

  const hasSharedView = isSharedViewActive || Boolean(sharedViewSlug);
  const isSharedViewLocked = Boolean(viewPasswordPrompt) || isSharedViewPending;
  const shouldShowExitSharedView =
    hasMounted && (isSharedViewActive || isSharedViewLocked);
  const canCreateRoadmaps = Boolean(
    userRoles?.canCreateRoadmaps || userRoles?.isSystemAdmin
  );

  useEffect(() => {
    if (!isSignedIn) return;
    if (!activeRoadmapId) return;
    if (!isOnline) return;
    if (isSharedViewActive) return;
    fetchViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, activeRoadmapId, isOnline, isSharedViewActive]);

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

  const handleExcelDownload = async () => {
    const csv = currentCsvText || buildCsvFromItems(items);
    const XLSX = await import("xlsx");
    const csvWorkbook = XLSX.read(csv, { type: "string" });
    const sheetName = csvWorkbook.SheetNames[0];
    const worksheet = sheetName
      ? csvWorkbook.Sheets[sheetName]
      : XLSX.utils.aoa_to_sheet([]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Roadmap");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const roadmapName =
      roadmaps.find((roadmap) => roadmap.id === activeRoadmapId)?.name ??
      "roadmap";
    const safeName = roadmapName
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[\\/:*?\"<>|]+/g, "-");
    const dateSuffix = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${safeName || "roadmap"}-${dateSuffix}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRefreshDatasource = async () => {
    if (!activeRoadmapId || isRefreshingDatasource || !isOnline) return;
    setIsRefreshingDatasource(true);
    try {
      const nextItems = await fetchDatasourceItems(activeRoadmapId, true);
      if (nextItems) {
        applyRoadmapItems(nextItems);
      }
    } finally {
      setIsRefreshingDatasource(false);
    }
  };

  const handleRefreshSharedView = async () => {
    if (isRefreshingDatasource || !isOnline) return;
    let slug = sharedViewSlug || loadedSharedSlug;
    if (!slug && typeof window !== "undefined") {
      slug = new URLSearchParams(window.location.search).get("view") ?? "";
    }
    if (!slug) return;
    setIsRefreshingDatasource(true);
    setIsSharedViewPending(true);
    const storedPassword = getStoredViewPassword(slug);
    const result = await loadSharedViewBySlug(slug, storedPassword);
    setIsRefreshingDatasource(false);
    setIsSharedViewPending(false);
    if (result.status === "password") {
      if (storedPassword) {
        setStoredViewPassword(slug, null);
      }
      setViewPasswordPrompt({ slug, error: result.error });
      setViewPasswordInput("");
    }
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
    setIsItemsLoading(false);
    notesCacheRef.current = {};
    notesReadyRef.current = {};
    notesInFlightRef.current = {};
    setNotesReadyMap({});
    relatedCacheRef.current = {};
    relatedReadyRef.current = {};
    relatedInFlightRef.current = {};
    setRelatedReadyMap({});
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

  const handleExcelFile = async (file?: File | null) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return;
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], {
      blankrows: false,
    });
    handleCsvUploadText(csv);
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
    const previousExportWidth = exportNode.style.width;
    const previousExportMaxWidth = exportNode.style.maxWidth;
    const previousScrollWidth = scrollContainer?.style.width;
    const previousScrollOverflow = scrollContainer?.style.overflowX;
    const fullWidth =
      scrollContainer?.scrollWidth ||
      exportNode.scrollWidth ||
      exportNode.clientWidth;
    const pageWidthInches = exportPageSize === "legal" ? 14 : 11;
    const targetWidth = Math.max(fullWidth, pageWidthInches * 300);

    exportNode.style.width = `${targetWidth}px`;
    exportNode.style.maxWidth = "none";
    if (scrollContainer) {
      scrollContainer.style.width = `${targetWidth}px`;
      scrollContainer.style.overflowX = "visible";
    }
    const { toPng } = await import("html-to-image");
    const disabledSheets: CSSStyleSheet[] = [];
    if (typeof document !== "undefined") {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (!sheet.href) continue;
          const sheetUrl = new URL(sheet.href, window.location.origin);
          if (sheetUrl.origin !== window.location.origin) {
            sheet.disabled = true;
            disabledSheets.push(sheet);
          }
        } catch {
          // Ignore stylesheet parsing errors.
        }
      }
    }
    let dataUrl = "";
    try {
      dataUrl = await toPng(exportNode, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        skipFonts: true,
      });
    } finally {
      disabledSheets.forEach((sheet) => {
        sheet.disabled = false;
      });
    }
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
    stakeholder: "Sponsor",
    criticality: "Criticality",
    region: "Region",
    disposition: "Disposition",
  }[selectedGroupBy];
  const activeThemeOverrides =
    roadmapThemeConfig?.baseTheme === selectedTheme
      ? roadmapThemeConfig?.overrides ?? null
      : null;

  const appliedFilters = [
    selectedPillars.length ? `Pillars: ${selectedPillars.join(", ")}` : null,
    selectedRegions.length ? `Regions: ${selectedRegions.join(", ")}` : null,
    selectedCriticalities.length
      ? `Criticality: ${selectedCriticalities.join(", ")}`
      : null,
    selectedDispositions.length
      ? `Disposition: ${selectedDispositions.join(", ")}`
      : null,
    selectedPrimaryStakeholders.length
      ? `Sponsors: ${selectedPrimaryStakeholders.join(", ")}`
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
  const selectedRoadmapOption = selectedRoadmapValue
    ? roadmapOptions.find((option) => option.value === selectedRoadmapValue) ?? null
    : null;
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
        selectedPrimaryStakeholders: string[];
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
        displayOptions: {
          showRegionEmojis: boolean;
          showShortDescription: boolean;
          showConvention: boolean;
          titleAbove: boolean;
          itemVerticalPadding: number;
          laneDividerOpacity: number;
          itemStyle: "tile" | "line";
          lineTitleGap: number;
          showQuarters: boolean;
          showMonths: boolean;
          showDynamicHeader: boolean;
          darkMode: boolean;
          showBoldProjectBorders: boolean;
          boldProjectBorderColor: string;
          boldProjectBorderAlternateColor: string;
        };
        startDate: string;
        quartersToShow: number;
        isHeaderCollapsed: boolean;
        unplannedLayout: "list" | "board";
        fullWidth: boolean;
        unplannedFullWidth: boolean;
        capacityBucketSize: "week" | "quarter";
        capacityRoles: Array<"lead" | "sme">;
      }>;

      if (parsed.selectedPillars) setSelectedPillars(parsed.selectedPillars);
      if (parsed.selectedRegions) setSelectedRegions(parsed.selectedRegions);
      if (parsed.selectedCriticalities)
        setSelectedCriticalities(parsed.selectedCriticalities);
      if (parsed.selectedDispositions)
        setSelectedDispositions(parsed.selectedDispositions);
      if (parsed.selectedPrimaryStakeholders)
        setSelectedPrimaryStakeholders(parsed.selectedPrimaryStakeholders);
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
      if (typeof parsed.isHeaderCollapsed === "boolean") {
        setIsHeaderCollapsed(parsed.isHeaderCollapsed);
      }
      if (parsed.unplannedLayout) {
        setUnplannedLayout(parsed.unplannedLayout);
      }
      if (typeof parsed.fullWidth === "boolean") {
        setFullWidth(parsed.fullWidth);
      } else if (typeof parsed.unplannedFullWidth === "boolean") {
        setFullWidth(parsed.unplannedFullWidth);
      }
      if (parsed.capacityBucketSize) {
        setCapacityBucketSize(parsed.capacityBucketSize);
      }
      if (parsed.capacityRoles) {
        setCapacityRoles(parsed.capacityRoles);
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
      selectedPrimaryStakeholders,
      selectedImpactedStakeholders,
      selectedGroupBy,
      selectedTheme,
      displayOptions,
      startDate,
      quartersToShow,
      isHeaderCollapsed,
      unplannedLayout,
      fullWidth,
      capacityBucketSize,
      capacityRoles,
    };
    localStorage.setItem(settingsKey, JSON.stringify(payload));
  }, [
    isHydrated,
    selectedPillars,
    selectedRegions,
    selectedCriticalities,
    selectedDispositions,
    selectedPrimaryStakeholders,
    selectedImpactedStakeholders,
    selectedGroupBy,
    selectedTheme,
    displayOptions,
    startDate,
    quartersToShow,
    isHeaderCollapsed,
    unplannedLayout,
    fullWidth,
    capacityBucketSize,
    capacityRoles,
    settingsKey,
  ]);

  useEffect(() => {
    let result = [...items];
    if (selectedPillars.length > 0) {
      const selected = new Set(selectedPillars.map(normalizeFilterValue));
      result = result.filter((i) =>
        selected.has(normalizeFilterValue(i.pillar))
      );
    }
    if (selectedRegions.length > 0) {
      result = result.filter((i) => {
        const regions = parseRegions(i.region);
        return selectedRegions.some((region) => regions.includes(region));
      });
    }
    if (selectedCriticalities.length > 0) {
      const selected = new Set(selectedCriticalities.map(normalizeFilterValue));
      result = result.filter((i) =>
        selected.has(normalizeFilterValue(i.criticality))
      );
    }
    if (selectedDispositions.length > 0) {
      const selected = new Set(selectedDispositions.map(normalizeFilterValue));
      result = result.filter((i) =>
        selected.has(normalizeFilterValue(i.disposition))
      );
    }
    if (selectedPrimaryStakeholders.length > 0) {
      const selected = new Set(
        selectedPrimaryStakeholders.map(normalizeFilterValue)
      );
      result = result.filter((i) =>
        selected.has(normalizeFilterValue(i.executiveSponsor))
      );
    }
    if (selectedImpactedStakeholders.length > 0) {
      const selected = new Set(
        selectedImpactedStakeholders.map(normalizeFilterValue)
      );
      result = result.filter((i) => {
        const stakeholders = parseStakeholders(i.impactedStakeholders).map(
          normalizeFilterValue
        );
        return stakeholders.some((stakeholder) => selected.has(stakeholder));
      });
    }
    setFilteredItems(result);
  }, [
    items,
    selectedPillars,
    selectedRegions,
    selectedCriticalities,
    selectedDispositions,
    selectedPrimaryStakeholders,
    selectedImpactedStakeholders,
  ]);

  const isUnplanned = viewMode === "unplanned";
  const isCapacity = viewMode === "capacity";
  const plannedItems = filteredItems.filter(hasValidTimelineDates);
  const unplannedItems = filteredItems.filter(
    (item) => !hasValidTimelineDates(item)
  );

  useEffect(() => {
    if (!canViewCapacity && viewMode === "capacity") {
      setViewMode("planned");
      if (typeof window !== "undefined") {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("mode");
        window.history.replaceState(null, "", nextUrl.toString());
      }
    }
  }, [canViewCapacity, viewMode]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className={[
          fullWidth
            ? "max-w-none w-full px-4 py-8 space-y-6"
            : "max-w-screen-2xl mx-auto px-4 py-8 space-y-6",
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
          <div className="space-y-1 pl-5">
            <h1 className="text-3xl font-semibold tracking-tight">
              <span className="text-blue-700">Roadmap</span>{" "}
              <span className="text-slate-900 dark:text-slate-100">to</span>{" "}
              <span className="text-red-600">Liberty</span>
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {isUnplanned
                ? "Review unplanned work items that need dates."
                : isCapacity
                  ? "Review workload by person and time bucket."
                  : "Visualize roadmap ideas across pillars, time, and regions."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
        {(isSignedIn || isSharedViewActive) ? (
          <SignedIn>
            <div className="flex flex-wrap items-center gap-2">
              {!isSharedViewActive ? (
                <>
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Roadmap
                  </span>
                  <details
                    data-dropdown
                    className="relative"
                    open={isRoadmapMenuOpen}
                    onToggle={(event) =>
                      setIsRoadmapMenuOpen(
                        (event.target as HTMLDetailsElement).open
                      )
                    }
                  >
                    <summary className="list-none inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 cursor-pointer hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800">
                      <span className="max-w-[220px] truncate">
                        {selectedRoadmapOption?.roadmap.name ?? "Select roadmap"}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-3 w-3 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <div className="absolute right-0 z-[120] mt-2 w-[22rem] max-w-[90vw] rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <div className="max-h-72 overflow-auto">
                        {roadmapOptions.map((option) => (
                          <div
                            key={option.value}
                            className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleRoadmapSelect(option.value);
                                setIsRoadmapMenuOpen(false);
                              }}
                              className="flex-1 text-left"
                            >
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                {option.roadmap.name}
                              </div>
                              <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">
                                {option.roadmap.role}
                              </div>
                            </button>
                            {option.roadmap.role !== "viewer" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  handleRoadmapSelect(option.value);
                                  setIsRoadmapMenuOpen(false);
                                  setIsRoadmapManageOpen(true);
                                }}
                                className="rounded-full border border-slate-200 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                              >
                                Manage
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {canCreateRoadmaps ? (
                        <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => {
                              setIsRoadmapMenuOpen(false);
                              setIsRoadmapManageOpen(true);
                            }}
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          >
                            Create new roadmap
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </>
              ) : null}
              {activeRoadmapId && activeRoadmapRole && activeRoadmapRole !== "viewer" ? (
                <Link
                  href={`/theme-editor?roadmapId=${activeRoadmapId}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  Theme editor
                </Link>
              ) : null}
              {userRoles?.isSystemAdmin && !shouldShowExitSharedView ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  onClick={() => setIsAdminOpen(true)}
                >
                  Admin
                </button>
              ) : null}
              {!shouldShowExitSharedView ? (
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
                  Share
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      isRefreshingDatasource
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-200/60 animate-pulse dark:border-emerald-500/60 dark:bg-emerald-900/30 dark:text-emerald-100 dark:shadow-emerald-500/20"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
                    ].join(" ")}
                    onClick={handleRefreshSharedView}
                    disabled={!isOnline || isRefreshingDatasource}
                    title={isOnline ? "Refresh shared view" : "Offline. Refresh paused."}
                  >
                    <span
                      className={[
                        "inline-flex h-4 w-4 items-center justify-center",
                        isRefreshingDatasource ? "text-emerald-700 dark:text-emerald-200" : "text-emerald-600",
                      ].join(" ")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className={[
                          "h-4 w-4",
                          isRefreshingDatasource ? "animate-spin" : "",
                        ].join(" ")}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                        <path d="M21 3v6h-6" />
                      </svg>
                    </span>
                    Refresh data
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                    onClick={() => {
                      handleExitSharedView();
                      if (isSignedIn && isOnline) {
                        fetchRoadmaps();
                      }
                    }}
                    title="Exit shared view"
                  >
                    Exit shared view
                  </button>
                </>
              )}
              {activeDatasourceType === "azure-devops" ? (
                <button
                  type="button"
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    isRefreshingDatasource
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-200/60 animate-pulse dark:border-emerald-500/60 dark:bg-emerald-900/30 dark:text-emerald-100 dark:shadow-emerald-500/20"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
                  ].join(" ")}
                  onClick={handleRefreshDatasource}
                  disabled={!activeRoadmapId || !isOnline || isRefreshingDatasource}
                  title={
                    !isOnline
                      ? "Offline. Refresh paused."
                      : "Refresh datasource"
                  }
                >
                  <span
                    className={[
                      "inline-flex h-4 w-4 items-center justify-center",
                      isRefreshingDatasource ? "text-emerald-700 dark:text-emerald-200" : "text-emerald-600",
                    ].join(" ")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={[
                        "h-4 w-4",
                        isRefreshingDatasource ? "animate-spin" : "",
                      ].join(" ")}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  </span>
                  {isRefreshingDatasource ? "Refreshing..." : "Refresh data"}
                </button>
              ) : null}
            </div>
          </SignedIn>
        ) : null}
        {!isSignedIn && shouldShowExitSharedView ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={[
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                "disabled:cursor-not-allowed disabled:opacity-60",
                isRefreshingDatasource
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-200/60 animate-pulse dark:border-emerald-500/60 dark:bg-emerald-900/30 dark:text-emerald-100 dark:shadow-emerald-500/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800",
              ].join(" ")}
              onClick={handleRefreshSharedView}
              disabled={!isOnline || isRefreshingDatasource}
              title={isOnline ? "Refresh shared view" : "Offline. Refresh paused."}
            >
              <span
                className={[
                  "inline-flex h-4 w-4 items-center justify-center",
                  isRefreshingDatasource ? "text-emerald-700 dark:text-emerald-200" : "text-emerald-600",
                ].join(" ")}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={[
                    "h-4 w-4",
                    isRefreshingDatasource ? "animate-spin" : "",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </span>
              Refresh data
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              onClick={handleExitSharedView}
              title="Exit shared view"
            >
              Exit shared view
            </button>
          </div>
        ) : null}
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

        {!hasSharedView && !isSharedViewLocked ? (
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
        ) : null}

        {isSignedIn || hasSharedView || isSharedViewLocked ? (
          <>
            {isSharedViewLocked ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {viewPasswordPrompt
                  ? "Enter the password to view this shared roadmap."
                  : "Validating shared link..."}
              </div>
            ) : null}
            <div className={isSharedViewLocked ? "hidden" : ""}>
          {isLoadingRoadmaps ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Loading roadmaps...
            </div>
          ) : null}
          {activeRoadmapId && showDebugOutlines ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Debug
                  </span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Datasource
                  </span>
                </div>
                <div />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[180px,1fr]">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">
                    Type
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-100">
                    {activeDatasourceType ?? "csv"}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  onClick={async () => {
                    if (!activeRoadmapId) return;
                    const nextOpen = !isDebugItemsOpen;
                    setIsDebugItemsOpen(nextOpen);
                    if (!nextOpen) return;
                    if (debugItemsPayload) return;
                    setIsDebugItemsLoading(true);
                    const result = await fetchDatasourceItems(activeRoadmapId, true);
                    setDebugItemsPayload(result ?? []);
                    setIsDebugItemsLoading(false);
                  }}
                  title="View items payload"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">
                        Items
                      </div>
                      <div className="mt-1 text-lg font-semibold text-slate-700 dark:text-slate-100">
                        {datasourceDebug?.count ?? items.length}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      View payload
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-3 w-3 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </div>
                  </div>
                </button>
                {datasourceDebug?.warning ? (
                  <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[0.7rem] text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
                    {datasourceDebug.warning}
                  </div>
                ) : null}
                {datasourceDebug?.error ? (
                  <div className="sm:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[0.7rem] text-rose-700 dark:border-rose-700/60 dark:bg-rose-900/20 dark:text-rose-200">
                    {datasourceDebug.error}
                  </div>
                ) : null}
                {datasourceDebug?.stale ? (
                  <div className="sm:col-span-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[0.7rem] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Showing cached data.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {!isLoadingRoadmaps && roadmaps.length === 0 && !hasSharedView ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <div className="space-y-2">
                <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {canCreateRoadmaps ? "Create your first roadmap" : "No roadmaps yet"}
                </div>
                <p>
                  {canCreateRoadmaps
                    ? "You don’t have any roadmaps yet. Create one to start adding items or import a CSV."
                    : "You don’t have access to any roadmaps yet. Ask an owner to share one with you."}
                </p>
                {canCreateRoadmaps && activeRoadmapRole !== "viewer" ? (
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
                ) : null}
              </div>
            </div>
          ) : null}
          {!isLoadingRoadmaps && (roadmaps.length > 0 || hasSharedView) ? (
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
                "grid gap-3 md:gap-6",
                "md:grid-cols-[20rem_minmax(0,1fr)]",
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
              <div className="px-1 py-1 pl-5">
                {displayOptions.showDynamicHeader ? (
                  <div className="flex items-center gap-2 min-w-0">
                    {(() => {
                      return isEditingTitle ? (
                        <input
                          type="text"
                          value={titleDraft}
                          onChange={(event) => setTitleDraft(event.target.value)}
                          onBlur={() => {
                            commitTitleEdit();
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
                            className={[
                              "text-left text-xl font-semibold text-slate-900 truncate dark:text-slate-100",
                              canEditTitle
                                ? "hover:text-slate-700 dark:hover:text-slate-200"
                                : "",
                            ].join(" ")}
                            onClick={() => {
                              if (!canEditTitle) return;
                              setTitleDraft(titlePrefix);
                              setIsEditingTitle(true);
                            }}
                            title={canEditTitle ? "Edit title" : "Roadmap title"}
                            aria-label="Roadmap title"
                          >
                            {titlePrefix}
                          </button>
                          {canEditTitle ? (
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
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
              <div className="px-1 py-1">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          if (viewMode === "planned") return;
                          saveScrollPosition(viewMode);
                          setViewMode("planned");
                          if (typeof window !== "undefined") {
                            const nextUrl = new URL(window.location.href);
                            nextUrl.searchParams.delete("mode");
                            window.history.replaceState(null, "", nextUrl.toString());
                          }
                        }}
                        className={[
                          "px-3 py-1 rounded-full transition-colors",
                          viewMode === "planned"
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
                        ].join(" ")}
                      >
                        Roadmap
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (viewMode === "unplanned") return;
                          saveScrollPosition(viewMode);
                          setViewMode("unplanned");
                          if (typeof window !== "undefined") {
                            const nextUrl = new URL(window.location.href);
                            nextUrl.searchParams.set("mode", "unplanned");
                            window.history.replaceState(null, "", nextUrl.toString());
                          }
                        }}
                        className={[
                          "px-3 py-1 rounded-full transition-colors",
                          viewMode === "unplanned"
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
                        ].join(" ")}
                      >
                        Unplanned
                      </button>
                      {canViewCapacity ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (viewMode === "capacity") return;
                            saveScrollPosition(viewMode);
                            setViewMode("capacity");
                            if (typeof window !== "undefined") {
                              const nextUrl = new URL(window.location.href);
                              nextUrl.searchParams.set("mode", "capacity");
                              window.history.replaceState(null, "", nextUrl.toString());
                            }
                          }}
                          className={[
                            "px-3 py-1 rounded-full transition-colors",
                            viewMode === "capacity"
                              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
                          ].join(" ")}
                        >
                          Capacity
                        </button>
                      ) : null}
                    </div>
                    {!isSharedViewActive && !isCapacity ? (
                      <>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Saved Views:
                        </span>
                        <details className="relative" data-dropdown>
                          <summary className="list-none inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 cursor-pointer hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800">
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
                                <path d="M4 6h16" />
                                <path d="M4 12h16" />
                                <path d="M4 18h10" />
                              </svg>
                            </span>
                            {selectedViewValue
                              ? viewOptions.find((option) => option.value === selectedViewValue)
                                  ?.label ?? "Select"
                              : "Select"}
                            <svg
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              className="h-3 w-3 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </summary>
                          <div className="absolute left-0 z-[120] mt-2 w-96 max-w-[90vw] rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <SavedViewsPanel
                            isLoading={isLoadingViews}
                            views={views}
                            shareBaseUrl={shareBaseUrl}
                            onSaveView={handleSaveView}
                            onLoadView={handleLoadView}
                            onClearView={clearActiveView}
                            onRenameView={handleRenameView}
                            onDeleteView={handleDeleteView}
                            onCreateLink={handleCreateLink}
                            onDeleteLink={handleDeleteLink}
                            onUpdateView={handleUpdateView}
                            roadmapRole={activeRoadmapRole}
                            isSharedViewActive={isSharedViewActive}
                            activeViewId={loadedView?.id ?? null}
                            showDebugOutlines={showDebugOutlines}
                            variant="plain"
                          />
                          </div>
                        </details>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {!isSharedViewActive &&
                    !isCapacity &&
                    activeRoadmapRole &&
                    activeRoadmapRole !== "viewer" ? (
                    <details className="relative" data-dropdown>
                      <summary className="list-none inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800">
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
                      Import
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-3 w-3 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          if (csvInputRef.current) {
                            csvInputRef.current.value = "";
                            csvInputRef.current.click();
                          }
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Import CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (excelInputRef.current) {
                            excelInputRef.current.value = "";
                            excelInputRef.current.click();
                          }
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Import Excel
                      </button>
                    </div>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={(event) =>
                        handleCsvFile(event.target.files?.[0])
                      }
                    />
                    <input
                      ref={excelInputRef}
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      className="sr-only"
                      onChange={(event) =>
                        handleExcelFile(event.target.files?.[0])
                      }
                    />
                    </details>
                    ) : null}
                    {!isSharedViewActive ? (
                    <details className="relative" data-dropdown>
                      <summary className="list-none inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800">
                    <span className="inline-flex h-4 w-4 items-center justify-center text-slate-500">
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
                    Export
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-3 w-3 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => {
                        handleCsvDownload();
                        (document.activeElement as HTMLElement | null)?.blur();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
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
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleExcelDownload();
                        (document.activeElement as HTMLElement | null)?.blur();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
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
                          <rect x="4" y="3" width="16" height="18" rx="2" />
                          <path d="M8 7h8" />
                          <path d="M8 11h8" />
                          <path d="M8 15h6" />
                        </svg>
                      </span>
                      Export Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleExportImage();
                        (document.activeElement as HTMLElement | null)?.blur();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
                      disabled={isExporting || isUnplanned}
                      title={
                        isUnplanned
                          ? "Export image is only available on the roadmap view."
                          : undefined
                      }
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
                      {isExporting ? "Exporting..." : "Export image"}
                    </button>
                    {!isUnplanned ? (
                      <div className="mt-1 border-t border-slate-200 pt-2 dark:border-slate-700">
                        <div className="px-2 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          Print size
                        </div>
                        <div className="mt-2 flex items-center gap-3 px-2 pb-1">
                          <label className="flex items-center gap-2 text-[0.7rem] text-slate-600 dark:text-slate-300">
                            <input
                              type="radio"
                              name="export-size"
                              value="letter"
                              checked={exportPageSize === "letter"}
                              onChange={() => setExportPageSize("letter")}
                            />
                            Letter (11")
                          </label>
                          <label className="flex items-center gap-2 text-[0.7rem] text-slate-600 dark:text-slate-300">
                            <input
                              type="radio"
                              name="export-size"
                              value="legal"
                              checked={exportPageSize === "legal"}
                              onChange={() => setExportPageSize("legal")}
                            />
                            Legal (14")
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                    </details>
                    ) : null}
                  </div>
                </div>
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
                  "relative transition-[width] duration-[650ms] ease-in-out",
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
                <div
                  className={[
                    "sticky top-6 space-y-4 transition-[opacity,transform] duration-[650ms] ease-in-out",
                    isHeaderCollapsed ? "opacity-0 -translate-x-2 pointer-events-none" : "opacity-100 translate-x-0",
                  ].join(" ")}
                >
                  <RoadmapFilters
                    items={items}
                    isCapacity={viewMode === "capacity"}
                    selectedPillars={selectedPillars}
                    setSelectedPillars={setSelectedPillars}
                    selectedRegions={selectedRegions}
                    setSelectedRegions={setSelectedRegions}
                    selectedCriticalities={selectedCriticalities}
                    setSelectedCriticalities={setSelectedCriticalities}
                    selectedDispositions={selectedDispositions}
                    setSelectedDispositions={setSelectedDispositions}
                    selectedPrimaryStakeholders={selectedPrimaryStakeholders}
                    setSelectedPrimaryStakeholders={setSelectedPrimaryStakeholders}
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
                        viewMode={viewMode}
                        showDebugOutlines={showDebugOutlines}
                        isCollapsed={false}
                        onToggleCollapsed={() => setIsHeaderCollapsed(true)}
                      />
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
                {isCapacity ? (
                  <CapacityView
                    items={plannedItems}
                    startDate={startDate}
                    quartersToShow={quartersToShow}
                    bucketSize={capacityBucketSize}
                    roles={capacityRoles}
                    fullWidth={fullWidth}
                    onFullWidthChange={setFullWidth}
                    onBucketSizeChange={setCapacityBucketSize}
                    onRolesChange={setCapacityRoles}
                  />
                ) : isUnplanned ? (
                  <UnplannedList
                    items={unplannedItems}
                    groupBy={selectedGroupBy}
                    showShortDescription={displayOptions.showShortDescription}
                    showRegionEmojis={displayOptions.showRegionEmojis}
                    showNotes={canViewNotes}
                    onOpenNotes={handleOpenNotes}
                    onPrefetchNotes={handlePrefetchNotes}
                    notesReadyMap={notesReadyMap}
                    showRelated={canViewRelated}
                    onOpenRelated={handleOpenRelated}
                    onPrefetchRelated={handlePrefetchRelated}
                    relatedReadyMap={relatedReadyMap}
                    layout={unplannedLayout}
                    onLayoutChange={setUnplannedLayout}
                    fullWidth={fullWidth}
                    onFullWidthChange={setFullWidth}
                    exportSummary={{
                      viewBy: summaryViewBy,
                      titlePrefix,
                      filters: appliedFilters,
                    }}
                    isExporting={isExporting}
                    isLoading={isItemsLoading}
                    showDebugOutlines={showDebugOutlines}
                  />
                ) : (
                  <RoadmapTimeline
                    items={plannedItems}
                    groupBy={selectedGroupBy}
                    displayOptions={displayOptions}
                    theme={selectedTheme}
                    themeOverrides={activeThemeOverrides}
                    startDate={startDate}
                    quartersToShow={quartersToShow}
                    showNotes={canViewNotes}
                    onOpenNotes={handleOpenNotes}
                    onPrefetchNotes={handlePrefetchNotes}
                    notesReadyMap={notesReadyMap}
                    showRelated={canViewRelated}
                    onOpenRelated={handleOpenRelated}
                    onPrefetchRelated={handlePrefetchRelated}
                    relatedReadyMap={relatedReadyMap}
                    exportSummary={{
                      viewBy: summaryViewBy,
                      titlePrefix,
                      filters: appliedFilters,
                    }}
                    headerRight={
                      !isExporting ? (
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Quarter
                            </span>
                            <input
                              type="range"
                              min={-8}
                              max={8}
                              step={1}
                              value={getQuarterOffset()}
                              onChange={(event) =>
                                setQuarterOffset(Number(event.target.value))
                              }
                              className="h-2 w-32 accent-sky-600"
                              aria-label="Shift timeline quarters"
                            />
                            <span className="text-[0.7rem] font-semibold text-slate-500 dark:text-slate-400">
                              {getQuarterOffset() >= 0
                                ? `+${getQuarterOffset()}`
                                : getQuarterOffset()}
                            </span>
                            <select
                              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[0.7rem] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              value={quartersToShow}
                              onChange={(event) =>
                                setQuartersToShow(Number(event.target.value))
                              }
                            >
                              {[3, 4, 5, 6, 8, 10, 12].map((count) => (
                                <option key={count} value={count}>
                                  {count}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="inline-flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                            <span>Use full width</span>
                            <span className="relative inline-flex h-5 w-10 items-center">
                              <input
                                type="checkbox"
                                checked={fullWidth}
                                onChange={(event) => setFullWidth(event.target.checked)}
                                className="peer sr-only"
                              />
                              <span className="absolute inset-0 rounded-full bg-slate-200 transition peer-checked:bg-sky-600 dark:bg-slate-700 dark:peer-checked:bg-sky-400" />
                              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 dark:bg-slate-900 dark:peer-checked:bg-slate-900" />
                            </span>
                          </label>
                        </div>
                      ) : null
                    }
                    isExporting={isExporting}
                    showDebugOutlines={showDebugOutlines}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
        {isDebugItemsOpen ? (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Datasource items payload
                  </div>
                  <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                    {datasourceDebug?.count ?? items.length} items
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => setIsDebugItemsOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="mt-3 max-h-[70vh] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                {isDebugItemsLoading ? (
                  <div>Loading items payload...</div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(debugItemsPayload ?? [], null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        ) : null}
        </div>
          </>
        ) : null}
        {isRoadmapManageOpen && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40 px-4">
                <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Manage roadmaps
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRoadmapManageOpen(false)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-3">
                    <RoadmapManagerPanel
                      isLoading={isLoadingRoadmaps}
                      roadmaps={roadmaps}
                      currentUserId={userId ?? null}
                      activeRoadmapId={activeRoadmapId}
                      onLoadRoadmap={handleLoadRoadmap}
                      onCreateRoadmap={handleCreateRoadmap}
                      onRenameRoadmap={handleRenameRoadmap}
                      onDeleteRoadmap={handleDeleteRoadmap}
                      canCreateRoadmaps={canCreateRoadmaps}
                      showDebug={showDebugOutlines}
                      variant="plain"
                    />
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}
        {shareRoadmapId && typeof document !== "undefined" ? (
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
            canCreateRoadmaps={canCreateRoadmaps}
            showDebug={showDebugOutlines}
            shareOnly
            variant="plain"
          />
        ) : null}
        <RoadmapItemNotesDialog
          item={notesItem}
          notes={notes}
          isLoading={notesLoading}
          error={notesError}
          onClose={handleCloseNotes}
        />
        <RoadmapItemRelatedDialog
          item={relatedItem}
          groups={relatedGroups}
          isLoading={relatedLoading}
          error={relatedError}
          onClose={handleCloseRelated}
        />
        {userRoles?.isSystemAdmin ? (
          <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
        ) : null}
        {viewPasswordPrompt && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-900/50 px-4">
                <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    View password required
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Enter the password to open this shared view.
                  </p>
                  <input
                    type="password"
                    value={viewPasswordInput}
                    onChange={(event) => setViewPasswordInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleViewPasswordSubmit();
                      }
                    }}
                    className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    placeholder="Password"
                  />
                  {viewPasswordPrompt.error ? (
                    <p className="mt-2 text-xs text-rose-600">
                      {viewPasswordPrompt.error}
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={() => {
                        setViewPasswordPrompt(null);
                        setViewPasswordInput("");
                        clearSharedView();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isViewPasswordLoading}
                      onClick={handleViewPasswordSubmit}
                    >
                      Unlock view
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}
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
  const start = parseDateValue(item.startDate);
  const end = parseDateValue(item.endDate);
  if (!start || !end) return false;
  if (getDateKey(start) === getDateKey(end)) return false;
  if (end.getTime() < start.getTime()) return false;
  return true;
}

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getDateKey(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeFilterValue(value: string): string {
  return (value || "").trim().toLowerCase();
}

function saveScrollPosition(mode: RoadmapPageMode) {
  if (typeof window === "undefined") return;
  const key = getScrollStorageKey(mode);
  try {
    window.sessionStorage.setItem(key, String(window.scrollY || 0));
  } catch {
    // Ignore storage errors so navigation still works.
  }
}

function getScrollStorageKey(mode: RoadmapPageMode): string {
  const suffix =
    mode === "unplanned" ? "unplanned" : mode === "capacity" ? "capacity" : "planned";
  return `roadmap-scroll:${suffix}`;
}
