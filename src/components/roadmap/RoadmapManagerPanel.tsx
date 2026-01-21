'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import type { RoadmapDetail, RoadmapRole, RoadmapSummary } from '@/types/roadmaps';
import type { DirectoryUser } from '@/types/userDirectory';
import { UserSearchInput } from '@/components/shared/UserSearchInput';

type ShareEntry = {
  userId: string;
  userEmail?: string | null;
  role: RoadmapRole;
  createdAt: string;
  updatedAt: string;
};

interface Props {
  isLoading: boolean;
  roadmaps: RoadmapSummary[];
  activeRoadmapId?: string | null;
  currentUserId?: string | null;
  shareRoadmapId?: string | null;
  onShareRoadmapClose?: () => void;
  onLoadRoadmap: (roadmap: RoadmapSummary) => void;
  onCreateRoadmap: (name: string, csvText: string) => Promise<boolean>;
  onRenameRoadmap: (id: string, name: string) => Promise<boolean>;
  onDeleteRoadmap: (id: string) => Promise<boolean>;
  onShareUser: (id: string, userId: string, role: RoadmapRole) => Promise<boolean>;
  onUpdateShare: (id: string, userId: string, role: RoadmapRole) => Promise<boolean>;
  onRevokeShare: (id: string, userId: string) => Promise<boolean>;
  variant?: 'card' | 'plain';
}

const ROLE_ORDER: Record<RoadmapRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

const roleLabel = (role: RoadmapRole) =>
  role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer';

export function RoadmapManagerPanel({
  isLoading,
  roadmaps,
  activeRoadmapId,
  currentUserId,
  shareRoadmapId,
  onShareRoadmapClose,
  onLoadRoadmap,
  onCreateRoadmap,
  onRenameRoadmap,
  onDeleteRoadmap,
  onShareUser,
  onUpdateShare,
  onRevokeShare,
  variant = 'card',
}: Props) {
  const isPlain = variant === 'plain';
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<RoadmapSummary | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [shareRoadmap, setShareRoadmap] = useState<RoadmapSummary | null>(null);
  const [shareEntries, setShareEntries] = useState<ShareEntry[]>([]);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareUserQuery, setShareUserQuery] = useState('');
  const [shareSelectedUser, setShareSelectedUser] = useState<DirectoryUser | null>(null);
  const [shareRole, setShareRole] = useState<RoadmapRole>('editor');
  const [isDownloadingDelete, setIsDownloadingDelete] = useState(false);

  const sortedRoadmaps = useMemo(() => {
    return [...roadmaps].sort((a, b) => {
      const roleDiff = ROLE_ORDER[b.role] - ROLE_ORDER[a.role];
      if (roleDiff !== 0) return roleDiff;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [roadmaps]);

  useEffect(() => {
    if (!shareRoadmap) return;
    const latest = roadmaps.find((roadmap) => roadmap.id === shareRoadmap.id);
    if (latest) {
      setShareRoadmap(latest);
    }
  }, [roadmaps, shareRoadmap?.id]);

  const canEdit = (role: RoadmapRole) => ROLE_ORDER[role] >= ROLE_ORDER.editor;
  const canDelete = (role: RoadmapRole) => role === 'owner';
  const canShare = (role: RoadmapRole) => ROLE_ORDER[role] >= ROLE_ORDER.editor;

  const handleShare = (roadmap: RoadmapSummary) => {
    setShareRoadmap(roadmap);
    setShareEntries([]);
    setShareUserQuery('');
    setShareSelectedUser(null);
    setShareRole('editor');
  };

  useEffect(() => {
    if (!shareRoadmapId) return;
    const match = roadmaps.find((roadmap) => roadmap.id === shareRoadmapId);
    if (match) {
      handleShare(match);
    }
  }, [roadmaps, shareRoadmapId]);

  const fetchShares = async (roadmapId: string) => {
    setIsShareLoading(true);
    try {
      const res = await fetch(`/api/roadmaps/${roadmapId}/share`);
      if (!res.ok) {
        setShareEntries([]);
        return;
      }
      const data = await res.json();
      setShareEntries((data.shares ?? []) as ShareEntry[]);
    } catch {
      setShareEntries([]);
    } finally {
      setIsShareLoading(false);
    }
  };

  useEffect(() => {
    if (!shareRoadmap) return;
    fetchShares(shareRoadmap.id);
  }, [shareRoadmap?.id]);

  const downloadRoadmapCsv = async (roadmapId: string, roadmapName: string) => {
    setIsDownloadingDelete(true);
    try {
      const res = await fetch(`/api/roadmaps/${roadmapId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { roadmap?: RoadmapDetail };
      const csvText = data.roadmap?.csvText ?? '';
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = roadmapName
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[\\/:*?"<>|]+/g, '-');
      const dateSuffix = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${safeName || 'roadmap'}-${dateSuffix}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloadingDelete(false);
    }
  };

  const MAX_NAME = 40;

  const handleRename = (roadmap: RoadmapSummary) => {
    setEditingId(roadmap.id);
    setEditingName(roadmap.name.slice(0, MAX_NAME));
  };

  const commitRename = async (roadmap: RoadmapSummary) => {
    const trimmed = editingName.trim().slice(0, MAX_NAME);
    if (!trimmed) {
      setEditingId(null);
      setEditingName('');
      return;
    }
    if (trimmed !== roadmap.name) {
      await onRenameRoadmap(roadmap.id, trimmed);
    }
    setEditingId(null);
    setEditingName('');
  };

  const renderRoadmapRow = (roadmap: RoadmapSummary) => {
    const isActive = Boolean(activeRoadmapId && roadmap.id === activeRoadmapId);
    const rowClassName = isPlain
      ? 'group flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/70 bg-transparent px-3 py-1.5 text-xs transition-colors hover:bg-slate-100/60 dark:border-slate-700/60 dark:hover:bg-slate-800/40'
      : 'group flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800';

    return (
      <div key={roadmap.id} className={rowClassName}>
        <div className="flex items-center gap-2">
          {editingId === roadmap.id ? (
            <input
              type="text"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              maxLength={MAX_NAME}
              onBlur={() => commitRename(roadmap)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitRename(roadmap);
                }
                if (event.key === 'Escape') {
                  setEditingId(null);
                  setEditingName('');
                }
              }}
              className="w-40 rounded-md border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              autoFocus
            />
          ) : (
            <button
              type="button"
              className={[
                'inline-flex items-center gap-1 font-medium hover:underline',
                isActive
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-slate-100',
              ].join(' ')}
              onClick={() => onLoadRoadmap(roadmap)}
              title="Load roadmap"
            >
              {roadmap.name}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {roleLabel(roadmap.role)}
          </span>
          {isActive ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
              Active
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {canEdit(roadmap.role) ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 p-1 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => handleRename(roadmap)}
                aria-label={`Rename ${roadmap.name}`}
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
            {canDelete(roadmap.role) ? (
              <button
                type="button"
                className="rounded-full border border-rose-200 p-1 text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-700/60 dark:text-rose-300 dark:hover:border-rose-600 dark:hover:bg-rose-900/40"
                onClick={() => setPendingDelete(roadmap)}
                aria-label={`Delete ${roadmap.name}`}
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

  const shareRoleOptions = shareRoadmap
    ? (['editor', 'owner'] as RoadmapRole[]).filter(
        (role) => ROLE_ORDER[role] <= ROLE_ORDER[shareRoadmap.role],
      )
    : (['editor', 'owner'] as RoadmapRole[]);

  const canManageShare = shareRoadmap ? canShare(shareRoadmap.role) : false;
  const canModifyEntry = (role: RoadmapRole, entryUserId: string) => {
    if (!shareRoadmap) return false;
    if (entryUserId === currentUserId) return false;
    if (shareRoadmap.role === 'owner') return true;
    return role === 'viewer';
  };
  const visibleShareEntries = shareEntries.filter(
    (entry) => entry.userId !== currentUserId,
  );

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
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Roadmaps</h2>
          <p className="text-[0.7rem] text-slate-500 dark:text-slate-400">
            Select a roadmap or create a new one.
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
          <span>Sign in to manage roadmaps.</span>
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
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-3 dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Delete roadmap?
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      This will delete “{pendingDelete.name}” and cannot be
                      undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() =>
                          downloadRoadmapCsv(pendingDelete.id, pendingDelete.name)
                        }
                        disabled={isDownloadingDelete}
                      >
                        {isDownloadingDelete ? 'Preparing...' : 'Download CSV'}
                      </button>
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
                        onClick={async () => {
                          await onDeleteRoadmap(pendingDelete.id);
                          setPendingDelete(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )
            : null}
          {shareRoadmap && typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg space-y-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Share “{shareRoadmap.name}”
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Role limit: {roleLabel(shareRoadmap.role)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => {
                          setShareRoadmap(null);
                          onShareRoadmapClose?.();
                        }}
                      >
                        Close
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Share with user
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <UserSearchInput
                          value={shareUserQuery}
                          placeholder="Search users by name or email"
                          disabled={!canManageShare}
                          onChange={(nextValue) => {
                            setShareUserQuery(nextValue);
                            setShareSelectedUser(null);
                          }}
                          onSelect={(user) => {
                            const label = user.email
                              ? `${user.displayName} (${user.email})`
                              : user.displayName;
                            setShareUserQuery(label);
                            setShareSelectedUser(user);
                          }}
                        />
                        <select
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                          value={shareRole}
                          onChange={(event) =>
                            setShareRole(event.target.value as RoadmapRole)
                          }
                          disabled={!canManageShare}
                        >
                          {shareRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={async () => {
                            const trimmed = shareUserQuery.trim();
                            const target = shareSelectedUser?.id ?? trimmed;
                            if (!target) return;
                            const ok = await onShareUser(shareRoadmap.id, target, shareRole);
                            if (ok) {
                              setShareUserQuery('');
                              setShareSelectedUser(null);
                              await fetchShares(shareRoadmap.id);
                            }
                          }}
                          disabled={!canManageShare || !(shareSelectedUser?.id ?? shareUserQuery.trim())}
                        >
                          Grant access
                        </button>
                      </div>
                    </div>

                    {!isShareLoading && visibleShareEntries.length === 0 ? null : (
                      <div className="space-y-2">
                        <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Current access
                        </div>
                        {isShareLoading ? (
                          <div className="text-xs text-slate-400 dark:text-slate-500">Loading...</div>
                        ) : (
                          <div className="space-y-2">
                            {visibleShareEntries.map((entry) => (
                                <div
                                  key={entry.userId}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700"
                                >
                                  <div className="text-slate-700 dark:text-slate-200">
                                    {entry.userEmail ?? entry.userId}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {canManageShare &&
                                    canModifyEntry(entry.role, entry.userId) &&
                                    entry.role !== 'viewer' ? (
                                      <select
                                        className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                        value={entry.role}
                                        onChange={async (event) => {
                                          const nextRole = event.target.value as RoadmapRole;
                                          if (nextRole === entry.role) return;
                                          const ok = await onUpdateShare(
                                            shareRoadmap.id,
                                            entry.userId,
                                            nextRole,
                                          );
                                          if (ok) {
                                            await fetchShares(shareRoadmap.id);
                                          }
                                        }}
                                      >
                                        {shareRoleOptions.map((role) => (
                                          <option key={role} value={role}>
                                            {roleLabel(role)}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                                        {roleLabel(entry.role)}
                                      </span>
                                    )}
                                    {canManageShare &&
                                    canModifyEntry(entry.role, entry.userId) &&
                                    entry.role === 'viewer' ? (
                                      <button
                                        type="button"
                                        className="rounded-full border border-slate-300 px-2 py-0.5 text-[0.7rem] text-slate-600 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                        onClick={async () => {
                                          const ok = await onUpdateShare(
                                            shareRoadmap.id,
                                            entry.userId,
                                            'editor',
                                          );
                                          if (ok) {
                                            await fetchShares(shareRoadmap.id);
                                          }
                                        }}
                                      >
                                        Upgrade to editor
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="rounded-full border border-rose-200 px-2 py-0.5 text-[0.7rem] text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700/60 dark:text-rose-300 dark:hover:bg-rose-900/40"
                                      onClick={async () => {
                                        if (
                                          !canManageShare ||
                                          !canModifyEntry(entry.role, entry.userId)
                                        ) {
                                          return;
                                        }
                                        const ok = await onRevokeShare(shareRoadmap.id, entry.userId);
                                        if (ok) {
                                          await fetchShares(shareRoadmap.id);
                                        }
                                      }}
                                      disabled={
                                        !canManageShare ||
                                        !canModifyEntry(entry.role, entry.userId)
                                      }
                                    >
                                      Revoke
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null}

          {isLoading ? (
            <div className="text-xs text-slate-400 dark:text-slate-500">Loading...</div>
          ) : null}
          <div className="space-y-2">
            {sortedRoadmaps.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No roadmaps yet.
              </div>
            ) : (
              sortedRoadmaps.map((roadmap) => renderRoadmapRow(roadmap))
            )}
          </div>

          <div
            className={
              isPlain
                ? 'space-y-2 pt-3'
                : 'rounded-md border border-slate-200 bg-slate-50/70 p-2 space-y-2 dark:border-slate-700 dark:bg-slate-800'
            }
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Create roadmap
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, MAX_NAME))}
                maxLength={MAX_NAME}
                placeholder="Roadmap name"
                className="w-48 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              />
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={async () => {
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  const ok = await onCreateRoadmap(trimmed, '');
                  if (ok) {
                    setName('');
                  }
                }}
                disabled={!name.trim()}
              >
                Create roadmap
              </button>
            </div>
          </div>
        </div>
      </SignedIn>
    </section>
  );
}
