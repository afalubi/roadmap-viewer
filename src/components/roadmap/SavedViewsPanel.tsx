'use client';

import { useState } from 'react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import type { SavedView, ViewPayload, ViewScope } from '@/types/views';

interface Props {
  isLoading: boolean;
  personalViews: SavedView[];
  sharedViews: SavedView[];
  shareBaseUrl?: string;
  onSaveView: (name: string, scope: ViewScope) => void;
  onLoadView: (payload: ViewPayload) => void;
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
  const [activeTab, setActiveTab] = useState<ViewScope>('personal');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ViewScope>('personal');

  const views = activeTab === 'personal' ? personalViews : sharedViews;

  const buildShareUrl = (view: SavedView) => {
    if (!shareBaseUrl || !view.sharedSlug) return null;
    return `${shareBaseUrl}/?view=${view.sharedSlug}`;
  };

  const handleCopyLink = async (view: SavedView) => {
    const url = buildShareUrl(view);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy share link', url);
    }
  };

  const handleRename = (view: SavedView) => {
    const next = window.prompt('Rename view', view.name);
    if (!next) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    onRenameView(view.id, view.scope, trimmed);
  };

  const handleDelete = (view: SavedView) => {
    if (!window.confirm(`Delete "${view.name}"?`)) return;
    onDeleteView(view.id, view.scope);
  };

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-800">Saved Views</h2>
          <p className="text-xs text-slate-500">
            Save combinations of filters and display options.
          </p>
        </div>
      </div>

      <SignedOut>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          <span>Sign in to save and load views.</span>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={[
                'rounded-full border px-3 py-1 text-xs',
                activeTab === 'personal'
                  ? 'border-slate-400 bg-slate-100 text-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
              onClick={() => setActiveTab('personal')}
            >
              Personal
            </button>
            <button
              type="button"
              className={[
                'rounded-full border px-3 py-1 text-xs',
                activeTab === 'shared'
                  ? 'border-slate-400 bg-slate-100 text-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
              onClick={() => setActiveTab('shared')}
            >
              Shared
            </button>
            {isLoading ? (
              <span className="text-xs text-slate-400">Loading...</span>
            ) : null}
          </div>

          <div className="space-y-2">
            {views.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
                No {activeTab} views saved yet.
              </div>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <div className="font-medium text-slate-700">{view.name}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => onLoadView(view.payload)}
                    >
                      Load
                    </button>
                    {view.scope === 'shared' ? (
                      view.sharedSlug ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          onClick={() => handleCopyLink(view)}
                        >
                          Copy link
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          onClick={() => onGenerateLink(view.id)}
                        >
                          Create link
                        </button>
                      )
                    ) : null}
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      onClick={() => handleRename(view)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-rose-200 px-2 py-0.5 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                      onClick={() => handleDelete(view)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Save current view
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="View name"
                className="w-48 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white"
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
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
