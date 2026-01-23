'use client';

import type { RoadmapItem } from '@/types/roadmap';

interface Props {
  item: RoadmapItem | null;
  onClose: () => void;
}

export function RoadmapItemDetailDialog({ item, onClose }: Props) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4 dark:bg-slate-900">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold dark:text-slate-100">{item.title}</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Pillar: <span className="font-medium">{item.pillar}</span> ·
              Region: <span className="font-medium">{item.region}</span> ·
              Expense: <span className="font-medium">{item.expenseType}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <DetailField label="Start date" value={formatDateOnly(item.startDate)} />
            <DetailField label="End date" value={formatDateOnly(item.endDate)} />
            <DetailField label="T-shirt size" value={item.tShirtSize} />
            <DetailField label="Criticality" value={item.criticality} />
            <DetailField label="Disposition" value={item.disposition} />
            {item.url ? (
              <p className="text-slate-700 dark:text-slate-200">
                <span className="font-semibold text-slate-600 mr-1 dark:text-slate-300">
                  Work item:
                </span>
                <a
                  href={item.url}
                  className="text-sky-700 hover:text-sky-900 underline underline-offset-2 dark:text-sky-300 dark:hover:text-sky-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in DevOps
                </a>
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <DetailField label="Submitter" value={item.submitterName} />
            <DetailField label="Department" value={item.submitterDepartment} />
            <DetailField
              label="Submitter priority"
              value={item.submitterPriority}
            />
            <DetailField
              label="Impacted stakeholders"
              value={item.impactedStakeholders}
            />
            <DetailField label="Executive sponsor" value={item.executiveSponsor} />
            <DetailField label="Lead" value={item.lead} />
            <DetailField
              label="Point of contact / SME"
              value={item.pointOfContact}
            />
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <DetailBlock label="Short description" value={item.shortDescription} />
          <DetailBlock label="Long description" value={item.longDescription} />
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  if (!value) return null;
  return (
    <p className="text-slate-700 dark:text-slate-200">
      <span className="font-semibold text-slate-600 mr-1 dark:text-slate-300">{label}:</span>
      <span>{value}</span>
    </p>
  );
}

function formatDateOnly(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [year, month, day] = trimmed.slice(0, 10).split('-').map(Number);
    const parsedLocal = new Date(year, month - 1, day);
    if (!Number.isNaN(parsedLocal.getTime())) {
      return parsedLocal.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-semibold text-slate-600 mb-0.5 dark:text-slate-300">{label}</div>
      <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-line dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}
