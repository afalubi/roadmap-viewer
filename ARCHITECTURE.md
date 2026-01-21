# Technology Roadmap Viewer – Architecture & Setup

This document captures stack and structural guidance for the project.
See `PRODUCT.md` for functional and UX requirements.

## Stack Requirements
- **Next.js** (latest, App Router)
- **React** + **TypeScript**
- **Tailwind CSS** for styling

## Project Setup

**Goal for Codex:** Create a Next.js 14+ project using the App Router, TypeScript, and Tailwind.

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

## Directory Structure

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
