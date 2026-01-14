'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import type { SavedView, ViewPayload, ViewScope } from '@/types/views';

interface Props {
  isLoading: boolean;
  personalViews: SavedView[];
  sharedViews: SavedView[];
  shareBaseUrl?: string;
  onSaveView: (name: string, scope: ViewScope) => void;
  onLoadView: (payload: ViewPayload, name: string) => void;
  onRenameView: (id: string, scope: ViewScope, name: string) => void;
  onDeleteView: (id: string, scope: ViewScope) => void;
  onGenerateLink: (id: string) => void;
}

export function SavedViewsPanel({
  isLoading,
  personalViews,
  sharedViews,
  shareBaseUrl,
  onSaveView,
  onLoadView,
  onRenameView,
  onDeleteView,
  onGenerateLink,
}: Props) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ViewScope>('personal');
  const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadTimer, setLoadTimer] = useState<number | null>(null);
  const [shareView, setShareView] = useState<SavedView | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const sharedList = [...sharedViews].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const personalList = [...personalViews].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  const buildShareUrl = (view: SavedView) => {
    if (!shareBaseUrl || !view.sharedSlug) return null;
    return `${shareBaseUrl}/?view=${view.sharedSlug}`;
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
      window.prompt('Copy share link', url);
    }
  };

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
      onRenameView(view.id, view.scope, trimmed);
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
    onDeleteView(pendingDelete.id, pendingDelete.scope);
    setPendingDelete(null);
  };

  const renderViewRow = (view: SavedView, showShare: boolean) => (
    <div
      key={view.id}
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
    >
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
          <button
            type="button"
            className="font-medium text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100"
            onClick={() => handleRename(view)}
            aria-label={`Rename ${view.name}`}
            title="Rename"
          >
            {view.name}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full border border-slate-200 p-1 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            onClick={() => handleLoad(view)}
            aria-label={`Load ${view.name}`}
            title={loadingId === view.id ? 'Loading' : 'Load'}
          >
            {loadingId === view.id ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 3a9 9 0 1 0 9 9" />
              </svg>
            ) : (
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
                <path d="M6 4h8l4 4v12H6z" />
                <path d="M14 4v4h4" />
              </svg>
            )}
          </button>
          {showShare ? (
            view.sharedSlug ? (
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
            ) : (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[0.7rem] text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => onGenerateLink(view.id)}
                title="Create link"
              >
                Create link
              </button>
            )
          ) : null}
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
        </div>
      </div>
    </div>
  );

  const handleLoad = (view: SavedView) => {
    if (loadTimer) {
      window.clearTimeout(loadTimer);
    }
    setLoadingId(view.id);
    onLoadView(view.payload, view.name);
    const timer = window.setTimeout(() => {
      setLoadingId((current) => (current === view.id ? null : current));
    }, 600);
    setLoadTimer(timer);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2 dark:bg-slate-900 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Saved Views</h2>
      </div>

      <SignedOut>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
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
          {pendingDelete && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4">
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Share link
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 break-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {buildShareUrl(shareView)}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => setShareView(null)}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={handleShareCopy}
                      >
                        {shareCopied ? 'Copied' : 'Copy'}
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
            <div className="space-y-1">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Shared
              </div>
              {sharedList.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No shared views yet.
                </div>
              ) : (
                sharedList.map((view) => renderViewRow(view, true))
              )}
            </div>
            <div className="space-y-1">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Personal
              </div>
              {personalList.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No personal views yet.
                </div>
              ) : (
                personalList.map((view) => renderViewRow(view, false))
              )}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2 space-y-2 dark:border-slate-700 dark:bg-slate-800">
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
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as ViewScope)
                }
              >
                <option value="personal">Personal</option>
                <option value="shared">Shared</option>
              </select>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  onSaveView(trimmed, scope);
                  setName('');
                }}
                disabled={!name.trim()}
              >
                Save view
              </button>
            </div>
          </div>
        </div>
      </SignedIn>
    </section>
  );
}
