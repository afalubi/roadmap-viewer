'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AdminUserSummary } from '@/types/users';

type AdminStats = {
  total: number;
  byIdp: { clerk: number; azure_ad: number };
  unassignedAdUsers: number;
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

  const updateRole = async (
    userId: string,
    updates: { isSystemAdmin?: boolean; canCreateRoadmaps?: boolean },
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
            {showUnassignedAdOnly ? 'Showing AD without access' : 'Filter AD without access'}
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
                <th className="px-3 py-2 text-left font-semibold">Owned</th>
                <th className="px-3 py-2 text-left font-semibold">Shared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
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
      </div>
    </div>,
    document.body,
  );
}
