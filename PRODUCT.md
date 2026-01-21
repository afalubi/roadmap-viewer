# Technology Roadmap Viewer – Build Instructions (Next.js + React + Tailwind)

These are instructions for an AI coding assistant (e.g., GitHub Copilot / Codex) to build a **Technology Roadmap Viewer**.

The app:

- Uses **Next.js (latest, App Router)** + **React** + **TypeScript**
- Uses **Tailwind CSS** for styling
- Loads data from a **CSV file** (for now)
- Displays roadmap items as a **timeline with swimlanes by pillar**
- Shows a **quarter-based time header** starting from the current quarter
- Supports **filtering** (e.g., by Region, Pillar, Criticality)
- Shows a **detail view** when clicking an item
- Is **read-only** (no editing UI, no auth yet)

---

## 0. Project Setup

**Goal for Codex:** Create a new Next.js 14+ project using the App Router, TypeScript, and Tailwind.

1. **Create the Next.js app:**

   ```bash
   npx create-next-app@latest tech-roadmap-viewer \
     --typescript \
     --tailwind \
     --eslint \
     --app \
     --src-dir
   ```

2. **Install extra dependency for CSV parsing:**

   ```bash
   cd tech-roadmap-viewer
   npm install papaparse
   ```

3. Ensure Tailwind is already wired up by the Next.js starter. Use Tailwind classes for all styling.

---

## 1. Directory Structure

Use the following structure (inside `src/`):

- `app/`
  - `layout.tsx`
  - `page.tsx`
- `components/`
  - `layout/Shell.tsx` (optional wrapper)
  - `roadmap/RoadmapFilters.tsx`
  - `roadmap/RoadmapTimeline.tsx`
  - `roadmap/RoadmapSwimlane.tsx`
  - `roadmap/RoadmapItemDetailDialog.tsx`
- `lib/`
  - `loadRoadmap.ts`
  - `loadRoadmapFromCsv.ts`
  - `timeScale.ts`
  - `color.ts`
- `types/`
  - `roadmap.ts`

Also create:

- `public/data/roadmap.csv` as the initial data source.

---

## 2. Data Model

**File:** `src/types/roadmap.ts`

Define the roadmap item type and T-shirt size:

```ts
export type TShirtSize = 'XS' | 'S' | 'M' | 'L';

export interface RoadmapItem {
  id: string;
  title: string;
  submitterName: string;
  submitterDepartment: string;
  submitterPriority: string;
  shortDescription: string;
  longDescription: string;
  criticality: string;
  executiveSponsor: string;
  startDate: string;    // ISO date string
  endDate: string;      // ISO date string
  tShirtSize: TShirtSize;
  pillar: string;
  region: string;
  expenseType: string;
  pointOfContact: string;  // SME
  lead: string;
}
```

---

## 3. CSV Data Source

### 3.1 CSV File

**File:** `public/data/roadmap.csv`

Create a CSV with this header (match column names exactly):

```csv
id,title,submitterName,submitterDepartment,submitterPriority,shortDescription,longDescription,criticality,executiveSponsor,startDate,endDate,tShirtSize,pillar,region,expenseType,pointOfContact,lead
1,Modernize CRM,Jane Smith,Sales,High,CRM upgrade for Q3,Full migration from on-prem CRM to cloud,High,John Doe,2026-04-01,2026-09-30,L,Customer Experience,North America,CapEx,Sarah Lee,Michael Brown
```

Add more sample rows as needed.

### 3.2 CSV Loader

**File:** `src/lib/loadRoadmapFromCsv.ts`

Use Papa Parse to load the CSV client-side:

```ts
import Papa from 'papaparse';
import type { RoadmapItem, TShirtSize } from '@/types/roadmap';

const TSHIRT_NORMALIZATION: Record<string, TShirtSize> = {
  'xs': 'XS',
  's': 'S',
  'm': 'M',
  'l': 'L',
};

function normalizeTShirt(value: string): TShirtSize {
  const key = (value || '').trim().toLowerCase();
  return TSHIRT_NORMALIZATION[key] ?? 'M';
}

export async function loadRoadmapFromCsv(): Promise<RoadmapItem[]> {
  const res = await fetch('/data/roadmap.csv');
  const text = await res.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as any[];

  return rows.map((row, index) => ({
    id: row.id || String(index),
    title: row.title ?? '',
    submitterName: row.submitterName ?? '',
    submitterDepartment: row.submitterDepartment ?? '',
    submitterPriority: row.submitterPriority ?? '',
    shortDescription: row.shortDescription ?? '',
    longDescription: row.longDescription ?? '',
    criticality: row.criticality ?? '',
    executiveSponsor: row.executiveSponsor ?? '',
    startDate: row.startDate ?? '',
    endDate: row.endDate ?? '',
    tShirtSize: normalizeTShirt(row.tShirtSize ?? 'M'),
    pillar: row.pillar ?? '',
    region: row.region ?? '',
    expenseType: row.expenseType ?? '',
    pointOfContact: row.pointOfContact ?? '',
    lead: row.lead ?? '',
  }));
}
```

### 3.3 Generic Loader Wrapper

**File:** `src/lib/loadRoadmap.ts`

For now only CSV, but keep it switchable later:

```ts
import type { RoadmapItem } from '@/types/roadmap';
import { loadRoadmapFromCsv } from './loadRoadmapFromCsv';

const DATA_SOURCE: 'csv' | 'azure' = 'csv';

export async function loadRoadmap(): Promise<RoadmapItem[]> {
  if (DATA_SOURCE === 'csv') {
    return loadRoadmapFromCsv();
  }
  // TODO: Azure DevOps integration later
  return [];
}
```

---

## 4. Time Scale & Quarters

We need a quarter-based time axis starting from the **current quarter**.

**File:** `src/lib/timeScale.ts`

Implement a basic quarter helper:

```ts
import type { RoadmapItem } from '@/types/roadmap';

export interface QuarterBucket {
  label: string; // e.g., "Q1 2026"
  start: Date;
  end: Date;
}

function getQuarter(date: Date): 1 | 2 | 3 | 4 {
  const month = date.getMonth(); // 0-based
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

export function buildQuarterBuckets(items: RoadmapItem[]): QuarterBucket[] {
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

  // Ensure at least 8 quarters visible
  const quarters: QuarterBucket[] = [];
  let year = currentYear;
  let quarter = currentQuarter;

  const totalQuarters = 8;
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
    widthPercent: Math.max(2, Math.min(width, 100 - left)), // minimum visible width
  };
}
```

---

## 5. Pillar Color Helper

**File:** `src/lib/color.ts`

Map pillar names to Tailwind color classes deterministically:

```ts
const COLORS = [
  'bg-sky-100 hover:bg-sky-200 border-sky-300',
  'bg-emerald-100 hover:bg-emerald-200 border-emerald-300',
  'bg-amber-100 hover:bg-amber-200 border-amber-300',
  'bg-violet-100 hover:bg-violet-200 border-violet-300',
];

export function getPillarColorClasses(pillar: string): string {
  if (!pillar) return 'bg-slate-100 hover:bg-slate-200 border-slate-300';
  const index = Math.abs(
    pillar.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
  ) % COLORS.length;
  return COLORS[index];
}
```

---

## 6. Layout & Root Components

### 6.1 Root Layout

**File:** `src/app/layout.tsx`

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Technology Roadmap Viewer',
  description: 'Internal tool to visualize technology roadmap ideas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
```

### 6.2 Home Page

**File:** `src/app/page.tsx`

This page:

- Loads roadmap items (client-side).
- Manages filter state.
- Passes filtered data to the timeline.

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { loadRoadmap } from '@/lib/loadRoadmap';
import { RoadmapFilters } from '@/components/roadmap/RoadmapFilters';
import { RoadmapTimeline } from '@/components/roadmap/RoadmapTimeline';

export default function HomePage() {
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<RoadmapItem[]>([]);
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCriticality, setSelectedCriticality] = useState<string | null>(null);

  useEffect(() => {
    loadRoadmap().then((data) => {
      setItems(data);
      setFilteredItems(data);
    });
  }, []);

  useEffect(() => {
    let result = [...items];
    if (selectedPillar) {
      result = result.filter((i) => i.pillar === selectedPillar);
    }
    if (selectedRegion) {
      result = result.filter((i) => i.region === selectedRegion);
    }
    if (selectedCriticality) {
      result = result.filter((i) => i.criticality === selectedCriticality);
    }
    setFilteredItems(result);
  }, [items, selectedPillar, selectedRegion, selectedCriticality]);

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Technology Roadmap
          </h1>
          <p className="text-sm text-slate-600">
            Visualize roadmap ideas across pillars, time, and regions.
          </p>
        </header>

        <RoadmapFilters
          items={items}
          selectedPillar={selectedPillar}
          setSelectedPillar={setSelectedPillar}
          selectedRegion={selectedRegion}
          setSelectedRegion={setSelectedRegion}
          selectedCriticality={selectedCriticality}
          setSelectedCriticality={setSelectedCriticality}
        />

        <RoadmapTimeline items={filteredItems} />
      </div>
    </main>
  );
}
```

---

## 7. Filters Component

**File:** `src/components/roadmap/RoadmapFilters.tsx`

Provide filters for **Pillar**, **Region**, **Criticality** plus a clear button.

```tsx
'use client';

import type { RoadmapItem } from '@/types/roadmap';

interface Props {
  items: RoadmapItem[];
  selectedPillar: string | null;
  setSelectedPillar: (value: string | null) => void;
  selectedRegion: string | null;
  setSelectedRegion: (value: string | null) => void;
  selectedCriticality: string | null;
  setSelectedCriticality: (value: string | null) => void;
}

export function RoadmapFilters({
  items,
  selectedPillar,
  setSelectedPillar,
  selectedRegion,
  setSelectedRegion,
  selectedCriticality,
  setSelectedCriticality,
}: Props) {
  const pillars = Array.from(new Set(items.map((i) => i.pillar).filter(Boolean))).sort();
  const regions = Array.from(new Set(items.map((i) => i.region).filter(Boolean))).sort();
  const criticalities = Array.from(new Set(items.map((i) => i.criticality).filter(Boolean))).sort();

  const clearFilters = () => {
    setSelectedPillar(null);
    setSelectedRegion(null);
    setSelectedCriticality(null);
  };

  const selectClasses =
    'border border-slate-300 rounded-md px-2 py-1 text-sm bg-white';

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Pillar</label>
          <select
            className={selectClasses}
            value={selectedPillar ?? ''}
            onChange={(e) => setSelectedPillar(e.target.value || null)}
          >
            <option value="">All</option>
            {pillars.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Region</label>
          <select
            className={selectClasses}
            value={selectedRegion ?? ''}
            onChange={(e) => setSelectedRegion(e.target.value || null)}
          >
            <option value="">All</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Criticality</label>
          <select
            className={selectClasses}
            value={selectedCriticality ?? ''}
            onChange={(e) => setSelectedCriticality(e.target.value || null)}
          >
            <option value="">All</option>
            {criticalities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={clearFilters}
          className="ml-auto text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}
```

---

## 8. Timeline & Swimlanes

### 8.1 Timeline Component

**File:** `src/components/roadmap/RoadmapTimeline.tsx`

- Groups items by **pillar**.
- Builds quarter buckets.
- Renders quarter header and swimlanes.
- Manages selected item for detail dialog.

```tsx
'use client';

import { useState } from 'react';
import type { RoadmapItem } from '@/types/roadmap';
import { buildQuarterBuckets } from '@/lib/timeScale';
import { RoadmapSwimlane } from './RoadmapSwimlane';
import { RoadmapItemDetailDialog } from './RoadmapItemDetailDialog';

interface Props {
  items: RoadmapItem[];
}

export function RoadmapTimeline({ items }: Props) {
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);

  const quarters = buildQuarterBuckets(items);

  const pillarsMap = new Map<string, RoadmapItem[]>();
  for (const item of items) {
    const key = item.pillar || 'Unassigned';
    if (!pillarsMap.has(key)) pillarsMap.set(key, []);
    pillarsMap.get(key)!.push(item);
  }

  const pillars = Array.from(pillarsMap.keys()).sort();

  return (
    <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div
            className="grid border-b border-slate-200"
            style={{ gridTemplateColumns: `160px repeat(${quarters.length}, minmax(0, 1fr))` }}
          >
            <div className="py-2 text-xs font-semibold text-slate-700 px-2">
              Pillar
            </div>
            {quarters.map((q) => (
              <div
                key={q.label}
                className="py-2 text-xs font-medium text-slate-700 text-center"
              >
                {q.label}
              </div>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {pillars.map((pillar) => (
              <RoadmapSwimlane
                key={pillar}
                pillar={pillar}
                items={pillarsMap.get(pillar)!}
                quarters={quarters}
                onSelectItem={setSelectedItem}
              />
            ))}
          </div>
        </div>
      </div>

      <RoadmapItemDetailDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </section>
  );
}
```

### 8.2 Swimlane Component

**File:** `src/components/roadmap/RoadmapSwimlane.tsx`

```tsx
'use client';

import type { RoadmapItem } from '@/types/roadmap';
import type { QuarterBucket } from '@/lib/timeScale';
import { getTimelinePosition } from '@/lib/timeScale';
import { getPillarColorClasses } from '@/lib/color';

interface Props {
  pillar: string;
  items: RoadmapItem[];
  quarters: QuarterBucket[];
  onSelectItem: (item: RoadmapItem) => void;
}

export function RoadmapSwimlane({
  pillar,
  items,
  quarters,
  onSelectItem,
}: Props) {
  const pillarColorClasses = getPillarColorClasses(pillar);

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: `160px repeat(${quarters.length}, minmax(0, 1fr))` }}
    >
      <div className="border-r border-slate-200 py-3 px-2 text-xs font-medium text-slate-800">
        {pillar}
      </div>

      <div className="relative col-span-full py-3">
        <div className="relative h-14">
          {items.map((item) => {
            const pos = getTimelinePosition(item, quarters);
            if (pos.widthPercent <= 0) return null;

            return (
              <button
                key={item.id}
                type="button"
                className={[
                  'absolute top-1 text-left text-xs px-2 py-1 rounded-md border shadow-sm cursor-pointer transition-colors',
                  pillarColorClasses,
                ].join(' ')}
                style={{
                  left: `${pos.leftPercent}%`,
                  width: `${pos.widthPercent}%`,
                }}
                onClick={() => onSelectItem(item)}
              >
                <div className="font-semibold truncate">{item.title}</div>
                <div className="text-[0.65rem] text-slate-700 truncate">
                  {item.shortDescription}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

---

## 9. Detail Dialog

**File:** `src/components/roadmap/RoadmapItemDetailDialog.tsx`

```tsx
'use client';

import type { RoadmapItem } from '@/types/roadmap';

interface Props {
  item: RoadmapItem | null;
  onClose: () => void;
}

export function RoadmapItemDetailDialog({ item, onClose }: Props) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="text-xs text-slate-600">
              Pillar: <span className="font-medium">{item.pillar}</span> · Region:{' '}
              <span className="font-medium">{item.region}</span> · Expense:{' '}
              <span className="font-medium">{item.expenseType}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <DetailField label="Start date" value={item.startDate} />
            <DetailField label="End date" value={item.endDate} />
            <DetailField label="T-shirt size" value={item.tShirtSize} />
            <DetailField label="Criticality" value={item.criticality} />
          </div>

          <div className="space-y-1">
            <DetailField label="Submitter" value={item.submitterName} />
            <DetailField label="Department" value={item.submitterDepartment} />
            <DetailField label="Submitter priority" value={item.submitterPriority} />
            <DetailField label="Executive sponsor" value={item.executiveSponsor} />
            <DetailField label="Lead" value={item.lead} />
            <DetailField label="Point of contact / SME" value={item.pointOfContact} />
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

function DetailField({ label, value }: { label: string; value: string | number }) {
  if (!value) return null;
  return (
    <p className="text-slate-700">
      <span className="font-semibold text-slate-600 mr-1">{label}:</span>
      <span>{value}</span>
    </p>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-semibold text-slate-600 mb-0.5">{label}</div>
      <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-line">
        {value}
      </p>
    </div>
  );
}
```

---

## 10. Acceptance Criteria

The implementation is “done” when:

1. Running `npm run dev` shows a page at `/` titled **Technology Roadmap**.
2. Data from `public/data/roadmap.csv` is loaded and rendered.
3. A quarter header appears (Qx YYYY), starting from **current quarter**, showing at least 8 quarters.
4. Items are grouped into **swimlanes by pillar**.
5. Items appear as horizontal bars roughly aligned to their start/end dates.
6. Clicking an item opens a detail dialog with all relevant fields.
7. Filters for **Pillar**, **Region**, and **Criticality** work and can be cleared.
8. Layout is usable on desktop and mobile (with horizontal scrolling if needed).
9. There is no editing UI and no authentication.
