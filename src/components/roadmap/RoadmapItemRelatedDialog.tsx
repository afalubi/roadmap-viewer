'use client';

import { createPortal } from 'react-dom';
import type { RoadmapItem } from '@/types/roadmap';

export type RoadmapItemRelated = {
  id: number;
  title: string;
  state: string;
  createdDate: string | null;
  changedDate?: string | null;
  resolvedDate?: string | null;
  closedDate?: string | null;
  targetDate?: string | null;
  url: string;
};

type GroupedRelated = {
  state: string;
  items: RoadmapItemRelated[];
};

interface Props {
  item: RoadmapItem | null;
  groups: GroupedRelated[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

const formatDateOnly = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export function RoadmapItemRelatedDialog({
  item,
  groups,
  isLoading,
  error,
  onClose,
}: Props) {
  if (!item || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[270] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Related work items for “{item.title}”
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-xs text-slate-700 dark:text-slate-200">
          {isLoading ? (
            <div className="text-slate-500 dark:text-slate-400">
              Loading related work items...
            </div>
          ) : error ? (
            <div className="text-rose-600 dark:text-rose-300">{error}</div>
          ) : groups.length === 0 ? (
            <div className="text-slate-500 dark:text-slate-400">
              No related work items found.
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.state} className="space-y-2">
                  <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {group.state}
                  </div>
                  <div className="space-y-2">
                    {group.items.map((related) => {
                      const state = related.state.toLowerCase();
                      const isActive = state === 'active';
                      const isNew = state === 'new';
                      const isResolved = state === 'resolved';
                      const isClosed = state === 'closed';
                      const isRemoved = state === 'removed';
                      let label = 'Entered';
                      let dateValue: string | null | undefined = related.createdDate;

                      if (isResolved) {
                        label = 'Resolved';
                        dateValue =
                          related.resolvedDate ?? related.changedDate ?? related.createdDate;
                      } else if (isRemoved) {
                        label = 'Removed';
                        dateValue = related.changedDate ?? related.createdDate;
                      } else if (isClosed) {
                        label = 'Closed';
                        dateValue = related.closedDate ?? related.changedDate ?? related.createdDate;
                      } else if (isActive) {
                        label = related.targetDate ? 'Target delivery' : 'Entered';
                        dateValue = related.targetDate ?? related.createdDate;
                      } else if (isNew) {
                        label = 'Entered';
                        dateValue = related.createdDate;
                      }

                      return (
                      <div
                        key={related.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={related.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline underline-offset-2 dark:text-sky-300 dark:hover:text-sky-200"
                          >
                            {related.title}
                          </a>
                          <span className="text-[0.65rem] text-slate-500 dark:text-slate-400">
                            {label}: {formatDateOnly(dateValue)}
                          </span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
