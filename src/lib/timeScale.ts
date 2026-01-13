import type { RoadmapItem } from '@/types/roadmap';

export interface QuarterBucket {
  label: string;
  start: Date;
  end: Date;
}

function getQuarter(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getMonth();
  return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4;
}

function getQuarterStart(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const month = (quarter - 1) * 3;
  return new Date(Date.UTC(year, month, 1));
}

function getQuarterEnd(year: number, quarter: 1 | 2 | 3 | 4): Date {
  const month = quarter * 3;
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

export function buildQuarterBuckets(
  items: RoadmapItem[],
  totalQuarters = 5,
): QuarterBucket[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = getQuarter(now);

  let minStart = getQuarterStart(currentYear, currentQuarter);
  let maxEnd = getQuarterEnd(currentYear, currentQuarter);

  for (const item of items) {
    if (item.startDate) {
      const d = new Date(item.startDate);
      if (d < minStart) minStart = d;
    }
    if (item.endDate) {
      const d = new Date(item.endDate);
      if (d > maxEnd) maxEnd = d;
    }
  }

  const quarters: QuarterBucket[] = [];
  let year = currentYear;
  let quarter = currentQuarter;

  for (let i = 0; i < totalQuarters; i++) {
    const start = getQuarterStart(year, quarter);
    const end = getQuarterEnd(year, quarter);
    quarters.push({
      label: `Q${quarter} ${year}`,
      start,
      end,
    });

    quarter = ((quarter % 4) + 1) as 1 | 2 | 3 | 4;
    if (quarter === 1) year += 1;
  }

  return quarters;
}

export interface TimelinePosition {
  leftPercent: number;
  widthPercent: number;
}

export function getTimelinePosition(
  item: RoadmapItem,
  quarters: QuarterBucket[],
): TimelinePosition {
  if (!item.startDate || !item.endDate || quarters.length === 0) {
    return { leftPercent: 0, widthPercent: 0 };
  }

  const start = new Date(item.startDate).getTime();
  const end = new Date(item.endDate).getTime();

  const timelineStart = quarters[0].start.getTime();
  const timelineEnd = quarters[quarters.length - 1].end.getTime();

  const clampedStart = Math.max(start, timelineStart);
  const clampedEnd = Math.min(end, timelineEnd);

  const totalDuration = timelineEnd - timelineStart || 1;
  const left = ((clampedStart - timelineStart) / totalDuration) * 100;
  const width = ((clampedEnd - clampedStart) / totalDuration) * 100;

  return {
    leftPercent: Math.max(0, Math.min(left, 100)),
    widthPercent: Math.max(2, Math.min(width, 100 - left)),
  };
}
