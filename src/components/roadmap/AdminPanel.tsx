'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminUserSummary } from '@/types/users';

type AdminStats = {
  total: number;
  byIdp: { clerk: number; azure_ad: number };
  unassignedAdUsers: number;
};

type AuditEntry = {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminPanel({ isOpen, onClose }: Props) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showUnassignedAdOnly, setShowUnassignedAdOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditIsLoading, setAuditIsLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) {
          setError('Unable to load users.');
          return;
        }
        const data = (await res.json()) as {
          users?: AdminUserSummary[];
          stats?: AdminStats;
        };
        if (!active) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
        setStats(data.stats ?? null);
      } catch {
        if (active) {
          setError('Unable to load users.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchUsers();
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'audit') return;
    let active = true;
    const fetchAudit = async () => {
      setAuditIsLoading(true);
      setAuditError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', '100');
        if (auditQuery.trim()) params.set('q', auditQuery.trim());
        if (auditAction.trim()) params.set('action', auditAction.trim());
        const res = await fetch(`/api/admin/audit?${params.toString()}`);
        if (!res.ok) {
          setAuditError('Unable to load audit log.');
          return;
        }
        const data = (await res.json()) as { audit?: AuditEntry[] };
        if (!active) return;
        setAudit(Array.isArray(data.audit) ? data.audit : []);
      } catch {
        if (active) {
          setAuditError('Unable to load audit log.');
        }
      } finally {
        if (active) {
          setAuditIsLoading(false);
        }
      }
    };
    fetchAudit();
    return () => {
      active = false;
    };
  }, [activeTab, auditQuery, auditAction, isOpen]);

  const filteredUsers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    let result = users;
    if (showUnassignedAdOnly) {
      result = result.filter(
        (user) => user.idp === 'azure_ad' && user.sharedCount === 0,
      );
    }
    if (!trimmed) return result;
    return result.filter((user) => {
      const email = user.email?.toLowerCase() ?? '';
      const name = user.displayName?.toLowerCase() ?? '';
      return email.includes(trimmed) || name.includes(trimmed) || user.id.includes(trimmed);
    });
  }, [query, users, showUnassignedAdOnly]);

  const userLookup = useMemo(() => {
    const lookup = new Map<string, AdminUserSummary>();
    users.forEach((user) => lookup.set(user.id, user));
    return lookup;
  }, [users]);

  const formatActor = (entry: AuditEntry) => {
    const user = userLookup.get(entry.actorUserId);
    if (!user) return entry.actorUserId;
    if (user.displayName && user.email) return `${user.displayName} (${user.email})`;
    return user.displayName || user.email || entry.actorUserId;
  };

  const formatTarget = (entry: AuditEntry) => {
    const meta = entry.metadata ?? {};
    const name = typeof meta.name === 'string' ? meta.name : '';
    const title = typeof meta.title === 'string' ? meta.title : '';
    const targetUserId =
      typeof meta.targetUserId === 'string' ? meta.targetUserId : '';
    const userEmail = typeof meta.userEmail === 'string' ? meta.userEmail : '';
    const roadmapId = typeof meta.roadmapId === 'string' ? meta.roadmapId : '';
    const viewId = typeof meta.viewId === 'string' ? meta.viewId : '';

    if (entry.targetType === 'roadmap') {
      return name || title || entry.targetId || 'Roadmap';
    }
    if (entry.targetType === 'user') {
      const user = entry.targetId ? userLookup.get(entry.targetId) : null;
      if (user) {
        if (user.displayName && user.email) return `${user.displayName} (${user.email})`;
        return user.displayName || user.email || entry.targetId || 'User';
      }
      return entry.targetId || 'User';
    }
    if (entry.targetType === 'roadmap_share') {
      const userLabel =
        userEmail ||
        (targetUserId
          ? userLookup.get(targetUserId)?.displayName ||
            userLookup.get(targetUserId)?.email ||
            targetUserId
          : '') ||
        'User';
      if (roadmapId) return `Roadmap ${roadmapId} · ${userLabel}`;
      return userLabel;
    }
    if (entry.targetType === 'view_link') {
      if (entry.targetId && viewId) return `Link ${entry.targetId} (view ${viewId})`;
      return entry.targetId || viewId || 'View link';
    }

    if (name || title) return name || title;
    return entry.targetId ? `${entry.targetType}:${entry.targetId}` : entry.targetType;
  };

  const updateRole = async (
    userId: string,
    updates: {
      isSystemAdmin?: boolean;
      canCreateRoadmaps?: boolean;
      canViewCapacity?: boolean;
    },
  ) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, ...updates } : user,
      ),
    );
    const res = await fetch(`/api/admin/users/${userId}/roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      setError('Unable to update user roles.');
      await new Promise((resolve) => setTimeout(resolve, 200));
      const refresh = await fetch('/api/admin/users');
      if (refresh.ok) {
        const data = (await refresh.json()) as {
          users?: AdminUserSummary[];
          stats?: AdminStats;
        };
        setUsers(Array.isArray(data.users) ? data.users : []);
        setStats(data.stats ?? null);
      }
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Admin
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage users, roles, and rollout status.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={[
              'rounded-full border px-3 py-1 text-xs',
              activeTab === 'users'
                ? 'border-sky-300 bg-sky-50 text-sky-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100',
            ].join(' ')}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            type="button"
            className={[
              'rounded-full border px-3 py-1 text-xs',
              activeTab === 'audit'
                ? 'border-sky-300 bg-sky-50 text-sky-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100',
            ].join(' ')}
            onClick={() => setActiveTab('audit')}
          >
            Audit
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">
              Total users
            </div>
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {stats?.total ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">
              IdP usage
            </div>
            <div className="mt-1 text-[0.7rem] text-slate-500 dark:text-slate-300">
              Clerk: {stats?.byIdp.clerk ?? 0} · AD: {stats?.byIdp.azure_ad ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <div className="text-[0.65rem] uppercase tracking-wide text-slate-400">
              AD users without access
            </div>
            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {stats?.unassignedAdUsers ?? 0}
            </div>
          </div>
        </div>

        {activeTab === 'users' ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search users"
                className="w-64 rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
              />
              <button
                type="button"
                className={[
                  'rounded-full border px-3 py-1 text-[0.7rem]',
                  showUnassignedAdOnly
                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100',
                ].join(' ')}
                onClick={() => setShowUnassignedAdOnly((prev) => !prev)}
              >
                {showUnassignedAdOnly
                  ? 'Showing AD without access'
                  : 'Filter AD without access'}
              </button>
              {isLoading ? (
                <span className="text-xs text-slate-400">Loading...</span>
              ) : null}
              {error ? (
                <span className="text-xs text-rose-600">{error}</span>
              ) : null}
            </div>

            <div className="mt-3 max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">User</th>
                    <th className="px-3 py-2 text-left font-semibold">IdP</th>
                    <th className="px-3 py-2 text-left font-semibold">System Admin</th>
                    <th className="px-3 py-2 text-left font-semibold">Can Create</th>
                    <th className="px-3 py-2 text-left font-semibold">Capacity</th>
                    <th className="px-3 py-2 text-left font-semibold">Owned</th>
                    <th className="px-3 py-2 text-left font-semibold">Shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-4 text-center text-slate-400"
                      >
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="bg-white dark:bg-slate-900">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {user.displayName || user.email || user.id}
                          </div>
                          <div className="text-[0.7rem] text-slate-500 dark:text-slate-400">
                            {user.email ?? 'No email'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-300">
                          {user.idp === 'azure_ad' ? 'Azure AD' : 'Clerk'}
                        </td>
                        <td className="px-3 py-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={user.isSystemAdmin}
                              onChange={(event) =>
                                updateRole(user.id, {
                                  isSystemAdmin: event.target.checked,
                                })
                              }
                            />
                            <span className="text-[0.7rem] text-slate-500">Admin</span>
                          </label>
                        </td>
                        <td className="px-3 py-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={user.canCreateRoadmaps}
                              onChange={(event) =>
                                updateRole(user.id, {
                                  canCreateRoadmaps: event.target.checked,
                                })
                              }
                            />
                            <span className="text-[0.7rem] text-slate-500">
                              Creator
                            </span>
                          </label>
                        </td>
                        <td className="px-3 py-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={user.canViewCapacity}
                              onChange={(event) =>
                                updateRole(user.id, {
                                  canViewCapacity: event.target.checked,
                                })
                              }
                            />
                            <span className="text-[0.7rem] text-slate-500">
                              View
                            </span>
                          </label>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {user.ownedCount}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {user.sharedCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={auditQuery}
                onChange={(event) => setAuditQuery(event.target.value)}
                placeholder="Search audit (target or metadata)"
                className="w-64 rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
              />
              <input
                type="text"
                value={auditAction}
                onChange={(event) => setAuditAction(event.target.value)}
                placeholder="Filter by action"
                className="w-40 rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200"
              />
              {auditIsLoading ? (
                <span className="text-xs text-slate-400">Loading...</span>
              ) : null}
              {auditError ? (
                <span className="text-xs text-rose-600">{auditError}</span>
              ) : null}
            </div>

            <div className="mt-3 max-h-[60vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Time</th>
                    <th className="px-3 py-2 text-left font-semibold">Actor</th>
                    <th className="px-3 py-2 text-left font-semibold">Action</th>
                    <th className="px-3 py-2 text-left font-semibold">Target</th>
                    <th className="px-3 py-2 text-left font-semibold">Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {audit.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center text-slate-400"
                      >
                        No audit entries found.
                      </td>
                    </tr>
                  ) : (
                    audit.map((entry) => (
                      <tr key={entry.id} className="bg-white dark:bg-slate-900">
                        <td className="px-3 py-2 text-[0.7rem] text-slate-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          <span title={entry.actorUserId}>{formatActor(entry)}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          {entry.action}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                          <span title={`${entry.targetType}${entry.targetId ? `:${entry.targetId}` : ''}`}>
                            {formatTarget(entry)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[0.7rem] text-slate-500">
                          {entry.metadata
                            ? JSON.stringify(entry.metadata)
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
