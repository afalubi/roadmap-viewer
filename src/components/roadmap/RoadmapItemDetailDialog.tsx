'use client';

import type { RoadmapItem } from '@/types/roadmap';
import { getRegionFlagAssets } from '@/lib/region';
import { renderRoadmapDescription } from '@/lib/markdown';

interface Props {
  item: RoadmapItem | null;
  onClose: () => void;
  hideDates?: boolean;
}

export function RoadmapItemDetailDialog({ item, onClose, hideDates = false }: Props) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/40 dark:bg-black/60">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 dark:bg-slate-900">
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
            <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
              <Badge label="Pillar" value={item.pillar} />
              <Badge label="Disposition" value={item.disposition} />
              <Badge label="Criticality" value={item.criticality} />
              <Badge
                label=""
                value={item.expenseType}
                showLabel={false}
                className="!border-amber-200 !bg-amber-50 !text-amber-900 dark:!border-amber-600 dark:!bg-amber-900/30 dark:!text-amber-100"
              />
            </div>
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
            <DetailField label="Sponsor" value={item.executiveSponsor} />
            {!hideDates ? (
              <>
                <DetailField label="Start date" value={formatDateOnly(item.startDate)} />
                <DetailField label="End date" value={formatDateOnly(item.endDate)} />
                <DetailField
                  label="Requested delivery date"
                  value={formatDateOnly(item.requestedDeliveryDate)}
                />
              </>
            ) : null}
            <DetailField label="T-shirt size" value={item.tShirtSize} />
            <DetailField label="Point of contact / SME" value={item.pointOfContact} />
            <DetailField label="Lead" value={item.lead} />
          </div>

          <div className="space-y-1">
            <SubmitterField name={item.submitterName} />
            <DetailField
              label="Submitter priority"
              value={item.submitterPriority}
            />
            <DetailField label="Stakeholders" value={item.impactedStakeholders} />
            {item.url ? (
              <p className="text-slate-700 dark:text-slate-200">
                <span className="font-semibold text-slate-600 mr-1 dark:text-slate-300">
                  Submitted idea:
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

function Badge({
  label,
  value,
  showLabel = true,
  className = '',
}: {
  label: string;
  value: string;
  showLabel?: boolean;
  className?: string;
}) {
  if (!value) return null;
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
        className,
      ].join(' ')}
    >
      {showLabel ? (
        <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      ) : null}
      <span>{value}</span>
    </span>
  );
}

function SubmitterField({
  name,
}: {
  name: string;
}) {
  if (!name) return null;
  return (
    <p className="text-slate-700 dark:text-slate-200">
      <span className="font-semibold text-slate-600 mr-1 dark:text-slate-300">
        Submitted by:
      </span>
      <span>{name}</span>
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
  const content = renderRoadmapDescription(value);
  return (
    <div>
      <div className="mb-0.5 font-semibold text-slate-900 underline underline-offset-2">
        {label}
      </div>
      <div
        className="roadmap-markdown text-slate-800 text-xs leading-relaxed dark:text-slate-100"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
