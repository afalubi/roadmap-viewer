'use client';

import { createPortal } from 'react-dom';
import type { RoadmapItem } from '@/types/roadmap';

export type RoadmapItemNote = {
  id: number;
  text: string;
  createdBy: string;
  createdDate: string | null;
  revisedDate: string | null;
};

interface Props {
  item: RoadmapItem | null;
  notes: RoadmapItemNote[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

const formatTimestamp = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const stripHtml = (value: string) =>
  value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

export function RoadmapItemNotesDialog({
  item,
  notes,
  isLoading,
  error,
  onClose,
}: Props) {
  if (!item || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notes for “{item.title}”
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Read-only discussion from Azure DevOps
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
            <div className="text-slate-500 dark:text-slate-400">Loading notes...</div>
          ) : error ? (
            <div className="text-rose-600 dark:text-rose-300">{error}</div>
          ) : notes.length === 0 ? (
            <div className="text-slate-500 dark:text-slate-400">
              No notes found on this work item.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="text-[0.7rem] font-semibold text-slate-600 dark:text-slate-300">
                    {note.createdBy}
                  </div>
                  <div className="text-[0.65rem] text-slate-500 dark:text-slate-400">
                    {formatTimestamp(note.createdDate)}
                  </div>
                  <div className="mt-2 whitespace-pre-line text-xs text-slate-800 dark:text-slate-100">
                    {stripHtml(note.text)}
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
