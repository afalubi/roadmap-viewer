# Capacity View Plan

## Goal
Add a capacity-impact view that shows each person assigned as **Lead** or **SME** on roadmap items and summarizes their load by **week** or **quarter** (selectable). Load = **count of roadmap items** per person per time bucket, with quick access to the items in each bucket.

## Non-Goals
- No hours/days or effort estimates.
- No auto-allocation logic beyond simple overlap.
- No people directory sync (AD, HR, etc.) in this phase.

## Assumptions
- Existing roadmap items already carry `lead` and `pointOfContact` (SME) fields.
- “Load” counts an item once per bucket if it overlaps the bucket.
- A person is identified by exact string value (case/trim normalized).
- Only one person per role per effort; if multiple names appear, use the first.
- Default bucket size = **week**.
- Only **planned** items are included (exclude unplanned items).

## UX / Feature Outline
1. **New View Mode:** Add a “Capacity” view alongside Planned/Unplanned.
2. **Time Bucket Selector:** Toggle between **Weekly** and **Quarterly** buckets (default weekly).
3. **People Grid:** Each row = person, each column = bucket (week or quarter). Role grouping is by sections; if a person serves in both roles, they appear twice (once under Lead, once under SME).
4. **Load Cell:** Display count of assigned items; clicking shows list of items (same detail dialog).
5. **Role Filter:** Toggle to include Lead, SME, or both.
6. **Search/Filter:** Filter by person name and optionally by pillar/region/criticality (reuse existing filters).

## Data Model / Logic
- **Assignment extraction:** For each item, gather assignees from Lead and SME fields.
  - Normalize with `trim()` and case-insensitive comparisons.
  - If multiple names are present, use the first token only.
- **Time overlap:** For a bucket (week or quarter), an item counts if:
  - item.startDate <= bucket.end AND item.endDate >= bucket.start
- **Planned-only:** Items without valid start/end dates are excluded (quietly omit).
- **Load map:** `Map<Person, Map<BucketKey, RoadmapItem[]>>`

## Implementation Steps (Phased)

### Phase 1 — Core capacity view (read-only)
1. **Routing/UI**
   - Add a new view option “Capacity” in the view mode toggle.
   - Create a new component (e.g., `CapacityView.tsx`) rendered when mode = capacity.
2. **Time Buckets**
   - Reuse existing quarter helpers for quarterly buckets.
   - Add a weekly bucket builder (based on current start date + visible range). Default to weekly.
3. **Assignment Extraction**
   - Add shared utility to parse assignees from Lead/SME fields (first token only).
4. **Grid + Interaction**
   - Render people rows and bucket columns.
   - Cell shows count; clicking opens an item list; clicking item opens detail dialog.
5. **Filters**
   - Add role filter (Lead/SME/Both).
   - Reuse existing filters (pillar/region/criticality) to narrow items.
   - Ensure only planned items are included.

### Phase 2 — UX polish
1. **Sticky row/column headers** for easier scanning.
2. **Density options** (compact/comfortable).
3. **Color scale** for higher loads (subtle intensity).
4. **Empty-state** and “no assignees found” messaging.

### Phase 3 — Saved views & exports
1. Save the capacity view settings in view payload (mode, role filter, bucket size).
2. Add CSV export of capacity summary (person x bucket count).

## Storage & Settings
- Extend `ViewPayload` to include:
  - `mode: 'capacity'`
  - `capacity: { bucketSize: 'week' | 'quarter'; roles: ('lead'|'sme')[] }`
- Persist to local tab settings as with other view options.

## API / Server
No new server endpoints required initially (uses existing roadmap item data).

## Acceptance Criteria
1. Capacity view appears as a selectable mode.
2. Weekly/Quarterly toggle updates bucket columns.
3. For each person, counts reflect the number of items overlapping each bucket.
4. Clicking a cell shows the list of matching items and opens item detail.
5. Filters and role toggles affect counts immediately.

## Open Questions
1. None for now.
