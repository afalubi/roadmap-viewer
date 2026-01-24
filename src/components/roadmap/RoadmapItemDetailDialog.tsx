'use client';

import DOMPurify from 'dompurify';
import type { RoadmapItem } from '@/types/roadmap';
import { getRegionFlagAssets } from '@/lib/region';

interface Props {
  item: RoadmapItem | null;
  onClose: () => void;
  hideDates?: boolean;
}

export function RoadmapItemDetailDialog({ item, onClose, hideDates = false }: Props) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4 dark:bg-slate-900">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold dark:text-slate-100">{item.title}</h2>
              {getRegionFlagAssets(item.region).length ? (
                <span className="inline-flex items-center gap-1">
                  {getRegionFlagAssets(item.region).map((flag) => (
                    <img
                      key={`${item.id}-${flag.region}`}
                      src={flag.src}
                      alt={flag.alt}
                      className="h-4 w-4 rounded-sm border border-white/60 shadow-sm"
                    />
                  ))}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Pillar: <span className="font-medium">{item.pillar}</span> ·
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
            {!hideDates ? (
              <>
                <DetailField label="Start date" value={formatDateOnly(item.startDate)} />
                <DetailField label="End date" value={formatDateOnly(item.endDate)} />
              </>
            ) : null}
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
            <SubmitterField
              name={item.submitterName}
              department={item.submitterDepartment}
            />
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

function SubmitterField({
  name,
  department,
}: {
  name: string;
  department: string;
}) {
  if (!name) return null;
  return (
    <p className="text-slate-700 dark:text-slate-200">
      <span className="font-semibold text-slate-600 mr-1 dark:text-slate-300">
        Submitted by:
      </span>
      <span>
        {name}
        {department ? ` (${department})` : ''}
      </span>
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
  const trimmed = value.trim();
  const hasHtml = /<[^>]+>/.test(trimmed);
  const content = hasHtml ? sanitizeRichText(trimmed) : trimmed;
  return (
    <div>
      <div className="font-semibold text-slate-600 mb-0.5 dark:text-slate-300">{label}</div>
      {hasHtml ? (
        <div
          className="text-slate-800 text-xs leading-relaxed prose prose-slate max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 dark:text-slate-100 dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-line dark:text-slate-100">
          {content}
        </p>
      )}
    </div>
  );
}

function sanitizeRichText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'a',
      'span',
      'div',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
  });
}
