'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import type { SavedView, ViewRole } from '@/types/views';

interface Props {
  isLoading: boolean;
  views: SavedView[];
  shareBaseUrl?: string;
  activeViewId?: string | null;
  onSaveView: (name: string) => void;
  onLoadView: (view: SavedView) => void;
  onRenameView: (id: string, name: string) => void;
  onDeleteView: (id: string) => void;
  onCreateLink: (
    id: string,
    options: { password?: string | null; rotate?: boolean },
  ) => Promise<boolean>;
  onDeleteLink: (id: string) => Promise<boolean>;
  onUpdateView: (view: SavedView) => Promise<boolean>;
  roadmapRole?: ViewRole | null;
  isSharedViewActive?: boolean;
  showDebugOutlines?: boolean;
  variant?: 'card' | 'plain';
}

const ROLE_ORDER: Record<ViewRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};


export function SavedViewsPanel({
  isLoading,
  views,
  shareBaseUrl,
  activeViewId,
  onSaveView,
  onLoadView,
  onRenameView,
  onDeleteView,
  onCreateLink,
  onDeleteLink,
  onUpdateView,
  roadmapRole,
  isSharedViewActive = false,
  showDebugOutlines = false,
  variant = 'card',
}: Props) {
  const baseUrl =
    shareBaseUrl ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  const isPlain = variant === 'plain';
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTimer, setToastTimer] = useState<number | null>(null);
  const [shareView, setShareView] = useState<SavedView | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareCopyFallbackOpen, setShareCopyFallbackOpen] = useState(false);
  const [shareCopyFallbackValue, setShareCopyFallbackValue] = useState('');
  const [pendingRemoveLink, setPendingRemoveLink] = useState<SavedView | null>(
    null,
  );

  const sortedViews = useMemo(() => {
    return [...views].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [views]);

  const MAX_VIEW_NAME = 20;

  const handleRename = (view: SavedView) => {
    setEditingId(view.id);
    setEditingName(view.name.slice(0, MAX_VIEW_NAME));
  };

  const handleDelete = (view: SavedView) => {
    setPendingDelete(view);
  };

  const commitRename = (view: SavedView) => {
    const trimmed = editingName.trim().slice(0, MAX_VIEW_NAME);
    if (!trimmed) {
      setEditingId(null);
      setEditingName('');
      return;
    }
    if (trimmed !== view.name) {
      onRenameView(view.id, trimmed);
    }
    setEditingId(null);
    setEditingName('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    onDeleteView(pendingDelete.id);
    setPendingDelete(null);
  };

  const handleLoad = (view: SavedView) => {
    onLoadView(view);
    setToastMessage(`Loaded view: ${view.name}`);
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
    setToastTimer(timer);
  };

  const canEdit = (role: ViewRole) => ROLE_ORDER[role] >= ROLE_ORDER.editor;
  const canDelete = (role: ViewRole) => ROLE_ORDER[role] >= ROLE_ORDER.editor;
  const canManageViews = Boolean(
    roadmapRole && ROLE_ORDER[roadmapRole] >= ROLE_ORDER.editor,
  );
  const canShare = (role: ViewRole) =>
    ROLE_ORDER[role] >= ROLE_ORDER.editor && canManageViews;

  const buildShareUrl = (view: SavedView) => {
    if (!baseUrl) return null;
    if (!view.sharedSlug) return null;
    return `${baseUrl}/?view=${view.sharedSlug}`;
  };

  const handleShare = (view: SavedView) => {
    setShareView(view);
    setShareCopied(false);
  };

  const handleShareCopy = async () => {
    if (!shareView) return;
    const url = buildShareUrl(shareView);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
    } catch {
      setShareCopyFallbackValue(url);
      setShareCopyFallbackOpen(true);
    }
  };

  useEffect(() => {
    if (!shareView) return;
    const latest = views.find((view) => view.id === shareView.id);
    if (latest) {
      setShareView(latest);
    }
  }, [views, shareView?.id]);

  const renderViewRow = (view: SavedView) => {
    const isActive = Boolean(activeViewId && view.id === activeViewId);
    const rowClassName = isPlain
      ? 'group flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/70 bg-transparent px-3 py-1.5 text-xs transition-colors hover:bg-slate-100/60 dark:border-slate-700/60 dark:hover:bg-slate-800/40'
      : 'group flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800';

    return (
      <div key={view.id} className={rowClassName}>
        <div className="flex items-center gap-2">
          {editingId === view.id ? (
            <input
              type="text"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              maxLength={MAX_VIEW_NAME}
              onBlur={() => commitRename(view)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitRename(view);
                }
                if (event.key === 'Escape') {
                  cancelRename();
                }
              }}
              className="w-40 rounded-md border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              autoFocus
            />
          ) : (
            <a
              href={`${baseUrl}/?viewId=${view.id}`}
              className={[
                'inline-flex items-center gap-1 font-semibold text-slate-800 underline decoration-sky-400/70 underline-offset-2 hover:text-slate-900 hover:decoration-sky-500 dark:text-slate-100 dark:hover:text-white',
                isActive
                  ? 'text-sky-700 decoration-sky-500/70 dark:text-sky-300'
                  : '',
              ].join(' ')}
              onClick={(event) => {
                event.preventDefault();
                handleLoad(view);
              }}
              aria-label={`Load ${view.name}`}
              title="Load view"
            >
              {view.name}
            </a>
          )}
          {isActive ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
              Active
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {isActive && canEdit(view.role) && !isSharedViewActive ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[0.7rem] text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                onClick={async () => {
                  const ok = await onUpdateView(view);
                  if (ok) {
                    setToastMessage(`Updated view: ${view.name}`);
                    if (toastTimer) {
                      window.clearTimeout(toastTimer);
                    }
                    const timer = window.setTimeout(() => {
                      setToastMessage(null);
                    }, 2200);
                    setToastTimer(timer);
                  }
                }}
                title="Update with current settings"
              >
                Update
              </button>
            ) : null}
            {canEdit(view.role) ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 p-1 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => handleRename(view)}
                aria-label={`Rename ${view.name}`}
                title="Rename"
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
            {canShare(view.role) ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 p-1 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => handleShare(view)}
                aria-label={`Share ${view.name}`}
                title="Share"
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
                  <circle cx="18" cy="5" r="2" />
                  <circle cx="6" cy="12" r="2" />
                  <circle cx="18" cy="19" r="2" />
                  <path d="M8 12l8-6" />
                  <path d="M8 12l8 6" />
                </svg>
              </button>
            ) : null}
            {canDelete(view.role) ? (
              <button
                type="button"
                className="rounded-full border border-rose-200 p-1 text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-700/60 dark:text-rose-300 dark:hover:border-rose-600 dark:hover:bg-rose-900/40"
                onClick={() => handleDelete(view)}
                aria-label={`Delete ${view.name}`}
                title="Delete"
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
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M6 6l1 14h10l1-14" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section
      className={
        isPlain
          ? 'space-y-2'
          : 'bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2 dark:bg-slate-900 dark:border-slate-700'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Saved Views</h2>
          <p className="text-[0.7rem] text-slate-500 dark:text-slate-400">
            Click a view name to load it.
          </p>
        </div>
      </div>

      <SignedOut>
        <div
          className={
            isPlain
              ? 'flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300'
              : 'flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }
        >
          <span>Sign in to save and load views.</span>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-1.5">
          {toastMessage ? (
            <div className="fixed top-6 left-1/2 z-[110] -translate-x-1/2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg ring-1 ring-slate-200/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              {toastMessage}
            </div>
          ) : null}
          {pendingDelete && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Delete saved view?
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      This will delete “{pendingDelete.name}” and cannot be
                      undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setPendingDelete(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:border-rose-600 dark:hover:bg-rose-900/40"
                        onClick={confirmDelete}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          {shareView && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Share “{shareView.name}”
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Link access is view-only.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setShareView(null)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Share link
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <span className="truncate">
                            {buildShareUrl(shareView) ?? 'Link unavailable'}
                          </span>
                          <button
                            type="button"
                            className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.7rem] text-slate-600 hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                            onClick={handleShareCopy}
                            disabled={!shareView.sharedSlug}
                            title="Copy share link"
                          >
                            {shareCopied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        {!shareView.sharedSlug ? (
                          <button
                            type="button"
                            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={async () => {
                              await onCreateLink(shareView.id, {});
                            }}
                          >
                            Create link
                          </button>
                        ) : null}
                        {shareView.sharedSlug ? (
                          <button
                            type="button"
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/60 dark:text-rose-200 dark:hover:bg-rose-900/40"
                            onClick={async () => {
                              setPendingRemoveLink(shareView);
                            }}
                          >
                            Remove link
                          </button>
                        ) : null}
                        {showDebugOutlines ? (
                          <button
                            type="button"
                            className="rounded-full border border-slate-300 px-3 py-1 text-[0.65rem] text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            onClick={() => {
                              if (!shareView) return;
                              const url = buildShareUrl(shareView) ?? '';
                              setShareCopyFallbackValue(url);
                              setShareCopyFallbackOpen(true);
                            }}
                          >
                            Test copy dialog
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          {pendingRemoveLink && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Remove share link?
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Anyone with the link will lose access to this view.
                    </p>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setPendingRemoveLink(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                        onClick={async () => {
                          if (!pendingRemoveLink) return;
                          await onDeleteLink(pendingRemoveLink.id);
                          setPendingRemoveLink(null);
                        }}
                      >
                        Remove link
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          {shareCopyFallbackOpen && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Copy share link
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Copy the link below.
                    </p>
                    <input
                      type="text"
                      readOnly
                      value={shareCopyFallbackValue}
                      onFocus={(event) => event.currentTarget.select()}
                      className="mt-3 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setShareCopyFallbackOpen(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          {isLoading ? (
            <div className="text-xs text-slate-400 dark:text-slate-500">Loading...</div>
          ) : null}
          <div className="space-y-2">
            {sortedViews.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No saved views yet.
              </div>
            ) : (
              sortedViews.map((view) => renderViewRow(view))
            )}
          </div>

          {canManageViews ? (
            <div
              className={
                isPlain
                  ? 'space-y-2 pt-3'
                  : 'rounded-md border border-slate-200 bg-slate-50/70 p-2 space-y-2 dark:border-slate-700 dark:bg-slate-800'
              }
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Save current view
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value.slice(0, MAX_VIEW_NAME))
                  }
                  maxLength={MAX_VIEW_NAME}
                  placeholder="View name"
                  className="w-48 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
                <button
                  type="button"
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    const trimmed = name.trim();
                    if (!trimmed) return;
                    onSaveView(trimmed);
                    setName('');
                  }}
                  disabled={!name.trim()}
                >
                  Save view
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </SignedIn>
    </section>
  );
}
