'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import type { RoadmapSummary } from '@/types/roadmaps';
import type { RoadmapThemeConfig } from '@/types/theme';
import type { ThemeOption } from '@/types/views';
import { THEME_OPTIONS } from '@/lib/themeOptions';
import {
  THEME_PALETTE_COUNTS,
  getLaneHeaderClassesByIndex,
  getLaneClassesByIndex,
  getItemClassesByIndex,
  getLaneBackgroundClassFromItem,
} from '@/lib/color';
import { useSearchParams } from 'next/navigation';

const DEFAULT_THEME: ThemeOption = 'executive';

const normalizeOverrides = (
  overrides: Array<string | null | undefined> | undefined,
  count: number,
) => {
  const result = Array.from({ length: count }, (_, index) => {
    const value = overrides?.[index];
    return typeof value === 'string' ? value : '';
  });
  return result;
};

const resizeOverrides = (values: string[], count: number) =>
  Array.from({ length: count }, (_, index) => values[index] ?? '');

export default function ThemeEditorClient() {
  const searchParams = useSearchParams();
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState('');
  const [baseTheme, setBaseTheme] = useState<ThemeOption>(DEFAULT_THEME);
  const [itemOverrides, setItemOverrides] = useState<string[]>([]);
  const [laneOverrides, setLaneOverrides] = useState<string[]>([]);
  const [headerOverrides, setHeaderOverrides] = useState<string[]>([]);
  const [isLoadingRoadmaps, setIsLoadingRoadmaps] = useState(true);
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const paletteCounts = THEME_PALETTE_COUNTS[baseTheme] ?? { item: 5, lane: 10 };

  const applyThemeConfig = (config: RoadmapThemeConfig | null) => {
    const nextBaseTheme = config?.baseTheme ?? DEFAULT_THEME;
    const nextCounts = THEME_PALETTE_COUNTS[nextBaseTheme] ?? {
      item: 5,
      lane: 10,
    };
    setBaseTheme(nextBaseTheme);
    setItemOverrides(
      normalizeOverrides(config?.overrides?.item, nextCounts.item),
    );
    setLaneOverrides(
      normalizeOverrides(config?.overrides?.lane, nextCounts.lane),
    );
    setHeaderOverrides(
      normalizeOverrides(
        config?.overrides?.header ?? config?.overrides?.lane,
        nextCounts.lane,
      ),
    );
  };

  useEffect(() => {
    let isActive = true;
    const fetchRoadmaps = async () => {
      setIsLoadingRoadmaps(true);
      try {
        const res = await fetch('/api/roadmaps');
        if (!res.ok) {
          setError('Unable to load roadmaps.');
          return;
        }
        const data = (await res.json()) as { roadmaps?: RoadmapSummary[] };
        if (!isActive) return;
        const list = Array.isArray(data.roadmaps) ? data.roadmaps : [];
        setRoadmaps(list);
        const queryId = searchParams.get('roadmapId') ?? '';
        const initialId =
          list.find((roadmap) => roadmap.id === queryId)?.id ??
          list[0]?.id ??
          '';
        setSelectedRoadmapId(initialId);
      } catch {
        if (isActive) {
          setError('Unable to load roadmaps.');
        }
      } finally {
        if (isActive) {
          setIsLoadingRoadmaps(false);
        }
      }
    };
    fetchRoadmaps();
    return () => {
      isActive = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!selectedRoadmapId) return;
    let isActive = true;
    const fetchTheme = async () => {
      setIsLoadingTheme(true);
      setStatus(null);
      setError(null);
      try {
        const res = await fetch(`/api/roadmaps/${selectedRoadmapId}/theme`);
        if (!res.ok) {
          setError('Unable to load theme configuration.');
          return;
        }
        const data = (await res.json()) as {
          themeConfig?: RoadmapThemeConfig | null;
        };
        if (!isActive) return;
        applyThemeConfig(data.themeConfig ?? null);
      } catch {
        if (isActive) {
          setError('Unable to load theme configuration.');
        }
      } finally {
        if (isActive) setIsLoadingTheme(false);
      }
    };
    fetchTheme();
    return () => {
      isActive = false;
    };
  }, [selectedRoadmapId]);

  const handleBaseThemeChange = (value: ThemeOption) => {
    const nextCounts = THEME_PALETTE_COUNTS[value] ?? { item: 5, lane: 10 };
    setBaseTheme(value);
    setItemOverrides((current) => resizeOverrides(current, nextCounts.item));
    setLaneOverrides((current) => resizeOverrides(current, nextCounts.lane));
    setHeaderOverrides((current) => resizeOverrides(current, nextCounts.lane));
  };

  const hasOverrides =
    itemOverrides.some((value) => value.trim()) ||
    laneOverrides.some((value) => value.trim()) ||
    headerOverrides.some((value) => value.trim());

  const handleSave = async () => {
    if (!selectedRoadmapId) return;
    setIsSaving(true);
    setStatus(null);
    setError(null);
    const normalizedItem = itemOverrides.map((value) =>
      value.trim() ? value.trim() : null,
    );
    const normalizedLane = laneOverrides.map((value) =>
      value.trim() ? value.trim() : null,
    );
    const normalizedHeader = headerOverrides.map((value) =>
      value.trim() ? value.trim() : null,
    );
    const overrides =
      normalizedItem.some(Boolean) ||
      normalizedLane.some(Boolean) ||
      normalizedHeader.some(Boolean)
        ? {
            ...(normalizedItem.some(Boolean) ? { item: normalizedItem } : {}),
            ...(normalizedLane.some(Boolean) ? { lane: normalizedLane } : {}),
            ...(normalizedHeader.some(Boolean)
              ? { header: normalizedHeader }
              : {}),
          }
        : undefined;
    const payload = {
      themeConfig: {
        baseTheme,
        ...(overrides ? { overrides } : {}),
      },
    };
    try {
      const res = await fetch(`/api/roadmaps/${selectedRoadmapId}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError('Unable to save theme configuration.');
        return;
      }
      setStatus('Theme saved.');
    } catch {
      setError('Unable to save theme configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOverrides = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmResetOverrides = () => {
    setItemOverrides(Array.from({ length: paletteCounts.item }, () => ''));
    setLaneOverrides(Array.from({ length: paletteCounts.lane }, () => ''));
    setHeaderOverrides(Array.from({ length: paletteCounts.lane }, () => ''));
    setIsResetConfirmOpen(false);
  };

  const getPreviewTextColor = (isDark: boolean) => {
    if (!isDark) return '#0f172a';
    if (baseTheme === 'metro-dark' || baseTheme === 'executive') return '#f1f5f9';
    return '#0f172a';
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Theme Editor</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Select a base theme and override palette colors for a roadmap.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to roadmap
          </Link>
        </div>

        <SignedOut>
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-3">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  Sign in
                </button>
              </SignInButton>
              <span>Sign in to edit roadmap themes.</span>
            </div>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Roadmap
                </div>
                <select
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  value={selectedRoadmapId}
                  onChange={(event) => setSelectedRoadmapId(event.target.value)}
                  disabled={isLoadingRoadmaps}
                >
                  {roadmaps.map((roadmap) => (
                    <option key={roadmap.id} value={roadmap.id}>
                      {roadmap.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Base theme
                </div>
                <select
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  value={baseTheme}
                  onChange={(event) =>
                    handleBaseThemeChange(event.target.value as ThemeOption)
                  }
                  disabled={isLoadingTheme}
                >
                  {THEME_OPTIONS.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={handleResetOverrides}
                  disabled={!hasOverrides || isLoadingTheme}
                >
                  Reset overrides
                </button>
                <button
                  type="button"
                  className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  onClick={handleSave}
                  disabled={isSaving || isLoadingTheme || !selectedRoadmapId}
                >
                  {isSaving ? 'Saving...' : 'Save theme'}
                </button>
              </div>
            </div>

            {status ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                {status}
              </div>
            ) : null}
            {error ? (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="mt-6 space-y-6">
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                  Preview swatches render on the same background colors used in the
                  roadmap view (light vs dark), so you see the real composite color.
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <span>Grouped lane + item overrides</span>
                    <span className="text-[0.65rem] font-medium normal-case text-slate-400 dark:text-slate-500">
                      by index
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <div className="space-y-2">
                      {Array.from({ length: paletteCounts.item }, (_, index) => {
                        const itemValue = itemOverrides[index] ?? '';
                        const laneValue = laneOverrides[index] ?? '';
                        const headerValue = headerOverrides[index] ?? '';
                        const hasRowOverrides =
                          Boolean(itemValue.trim()) ||
                          Boolean(laneValue.trim()) ||
                          Boolean(headerValue.trim());
                        const itemClass = getItemClassesByIndex(index, baseTheme);
                        const laneClass = getLaneClassesByIndex(index, baseTheme);
                        const headerClass =
                          baseTheme === 'executive' || baseTheme === 'mono'
                            ? getLaneHeaderClassesByIndex(index, baseTheme)
                            : getLaneBackgroundClassFromItem(itemClass);
                        const renderPreviewTile = (
                          isDark: boolean,
                          overrides?: {
                            item?: string;
                            lane?: string;
                            header?: string;
                          },
                        ) => {
                          const itemOverride = overrides?.item?.trim();
                          const laneOverride = overrides?.lane?.trim();
                          const headerOverride = overrides?.header?.trim();
                          return (
                            <div
                              className="rounded-md border p-2 shadow-sm"
                              style={{
                                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                borderColor: isDark ? '#334155' : '#e2e8f0',
                              }}
                            >
                              <div
                                className={[
                                  'relative h-3 w-16 rounded-sm',
                                  headerOverride ? '' : headerClass,
                                ].join(' ')}
                                title={
                                  isDark
                                    ? 'Header preview (dark)'
                                    : 'Header preview (light)'
                                }
                                style={{
                                  backgroundColor: headerOverride || undefined,
                                }}
                              >
                                <span
                                  className="absolute left-1 top-0 text-[0.45rem] font-semibold"
                                  style={{ color: getPreviewTextColor(isDark) }}
                                >
                                  Aa
                                </span>
                              </div>
                              <div
                                className={[
                                  'relative mt-2 h-7 w-16 rounded-sm',
                                  laneOverride ? '' : laneClass,
                                ].join(' ')}
                                title={
                                  isDark
                                    ? 'Lane preview (dark)'
                                    : 'Lane preview (light)'
                                }
                                style={{
                                  backgroundColor: laneOverride || undefined,
                                }}
                              >
                                <div
                                  className={[
                                    'absolute left-1 top-1 h-4 w-10 rounded-sm border shadow-sm flex items-center justify-center text-[0.45rem] font-semibold',
                                    itemOverride ? '' : itemClass,
                                  ].join(' ')}
                                  title={
                                    isDark
                                      ? 'Item preview (dark)'
                                      : 'Item preview (light)'
                                  }
                                  style={{
                                    color: getPreviewTextColor(isDark),
                                    backgroundColor: itemOverride || undefined,
                                    borderColor: itemOverride || undefined,
                                  }}
                                >
                                  Aa
                                </div>
                              </div>
                            </div>
                          );
                        };
                        return (
                          <div
                            key={`group-row-${index}`}
                            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-end gap-3">
                                <div className="space-y-1 text-center">
                                  <div className="text-[0.55rem] uppercase tracking-wide text-slate-400">
                                    Light
                                  </div>
                                  {renderPreviewTile(false)}
                                </div>
                                <div className="space-y-1 text-center">
                                  <div className="text-[0.55rem] uppercase tracking-wide text-slate-400">
                                    Dark
                                  </div>
                                  {renderPreviewTile(true)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[0.55rem] uppercase tracking-wide text-slate-400">
                                  Index {index + 1}
                                </div>
                                <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                                  Header / Lane / Item
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              {hasRowOverrides ? (
                                <div className="flex items-end gap-2">
                                  <div className="space-y-1 text-center">
                                    <div className="text-[0.55rem] uppercase tracking-wide text-slate-400">
                                      Override
                                    </div>
                                    {renderPreviewTile(false, {
                                      item: itemValue,
                                      lane: laneValue,
                                      header: headerValue,
                                    })}
                                  </div>
                                  <div className="space-y-1 text-center">
                                    <div className="text-[0.55rem] uppercase tracking-wide text-slate-400">
                                      Override
                                    </div>
                                    {renderPreviewTile(true, {
                                      item: itemValue,
                                      lane: laneValue,
                                      header: headerValue,
                                    })}
                                  </div>
                                </div>
                              ) : null}
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-12 text-[0.6rem] uppercase tracking-wide text-slate-400">
                                    Item
                                  </span>
                                  <input
                                    type="color"
                                    value={itemValue || '#ffffff'}
                                    onChange={(event) => {
                                      const next = [...itemOverrides];
                                      next[index] = event.target.value;
                                      setItemOverrides(next);
                                    }}
                                    className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent"
                                  />
                                  <input
                                    type="text"
                                    value={itemValue}
                                    placeholder="auto"
                                    onChange={(event) => {
                                      const next = [...itemOverrides];
                                      next[index] = event.target.value;
                                      setItemOverrides(next);
                                    }}
                                    className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-[0.7rem] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...itemOverrides];
                                      next[index] = '';
                                      setItemOverrides(next);
                                    }}
                                    className="text-[0.6rem] uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  >
                                    Clear
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-12 text-[0.6rem] uppercase tracking-wide text-slate-400">
                                    Lane
                                  </span>
                                  <input
                                    type="color"
                                    value={laneValue || '#ffffff'}
                                    onChange={(event) => {
                                      const next = [...laneOverrides];
                                      next[index] = event.target.value;
                                      setLaneOverrides(next);
                                    }}
                                    className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent"
                                  />
                                  <input
                                    type="text"
                                    value={laneValue}
                                    placeholder="auto"
                                    onChange={(event) => {
                                      const next = [...laneOverrides];
                                      next[index] = event.target.value;
                                      setLaneOverrides(next);
                                    }}
                                    className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-[0.7rem] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...laneOverrides];
                                      next[index] = '';
                                      setLaneOverrides(next);
                                    }}
                                    className="text-[0.6rem] uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  >
                                    Clear
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="w-12 text-[0.6rem] uppercase tracking-wide text-slate-400">
                                    Header
                                  </span>
                                  <input
                                    type="color"
                                    value={headerValue || '#ffffff'}
                                    onChange={(event) => {
                                      const next = [...headerOverrides];
                                      next[index] = event.target.value;
                                      setHeaderOverrides(next);
                                    }}
                                    className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-transparent"
                                  />
                                  <input
                                    type="text"
                                    value={headerValue}
                                    placeholder="auto"
                                    onChange={(event) => {
                                      const next = [...headerOverrides];
                                      next[index] = event.target.value;
                                      setHeaderOverrides(next);
                                    }}
                                    className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-[0.7rem] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...headerOverrides];
                                      next[index] = '';
                                      setHeaderOverrides(next);
                                    }}
                                    className="text-[0.6rem] uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SignedIn>
      </div>
      {isResetConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Reset theme overrides?
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              This will clear all item, lane, and header overrides for this roadmap.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetOverrides}
                className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Reset overrides
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
