# Azure DevOps Datasource Integration Plan

## Goal
Enable roadmaps to read items from Azure DevOps work items as an alternative datasource to CSV. The integration is read-only; the roadmap tool never updates Azure DevOps.

## Scope
- New datasource type: `azure-devops` alongside existing CSV (`csvText`)
- Flexible datasource framework to support future types (e.g., Jira)
- User-configurable Azure DevOps settings per roadmap (owners only)
- Connection validation before saving settings
- Read work items to populate roadmap timeline and filters
- No write-back to Azure DevOps

## Assumptions
- Azure DevOps REST API is used.
- A Personal Access Token (PAT) is used for authentication (read-only scope).
- Work item fields are mapped into existing `RoadmapItem` shape (or a compatible adapter is added).
- Current data model stores roadmaps in `roadmaps` with `csv_text` only (see `src/lib/roadmapsDb.ts` and `/api/roadmaps` routes).

## User Configuration Flow (Tailored to Current UI)
1. Add a "Data source" action in the roadmap manager UI (`src/components/roadmap/RoadmapManagerPanel.tsx`):
   - For each roadmap row, add a button (e.g., "Configure data source") near rename/delete.
   - Only show for owners (PAT and connection settings are sensitive).
2. Open a modal (pattern already used in the same component for share/delete) for configuration:
   - Selector: `CSV` (default) or `Azure DevOps`.
   - When `CSV` selected: show existing CSV upload/textarea behavior (if present) or keep as-is.
   - When `Azure DevOps` selected, show:
     - Organization URL (support both `https://dev.azure.com/{org}` and `https://{org}.visualstudio.com`)
     - Project name
     - Team (optional)
     - PAT (read-only scope)
     - Work Item Query: WIQL text or Saved Query ID (radio toggle)
     - Field mappings (optional advanced section)
       - Title, Start date, End date, Pillar, Region, Criticality, etc.
     - Refresh interval (optional; default 15 minutes, range 5–60)
3. On "Validate" click, call a new server endpoint to confirm credentials and query:
   - Validate URL and required fields on client first.
   - Show success/error inline in the modal.
4. On "Save", persist settings via existing `/api/roadmaps/[id]` update or a new settings endpoint.
   - Store PAT server-side only; never return it to the client after save.
   - Return a masked placeholder to indicate "PAT set".
   - Provide a "Replace PAT" / "Clear PAT" option for rotation.

## Data Access Architecture (Aligned to Current Routes, Flexible)
- Keep `/api/roadmaps` and `/api/roadmaps/[id]` for list/detail.
- Extend roadmap detail payload to include datasource config metadata (no secrets).
- Use datasource-agnostic endpoints (per-roadmap):
  - `GET /api/roadmaps/[id]/datasource` (returns current config without secrets)
  - `PUT /api/roadmaps/[id]/datasource` (updates config; stores secrets server-side)
  - `POST /api/roadmaps/[id]/datasource/validate` (validates current datasource)
  - `GET /api/roadmaps/[id]/datasource/items` (returns mapped `RoadmapItem[]`)
- Server implementation selects a handler by `datasourceType` (e.g., `csv`, `azure-devops`, `jira`).
- Client roadmap loader always calls `/api/roadmaps/[id]/datasource/items` and stays agnostic to type.
  - On user login, trigger a fresh fetch (bypass cache) for the active roadmap.
- Access control: `/datasource/items` requires at least viewer role for the roadmap.

## Implementation Steps (Tailored)

### 1) Data model and configuration
- Add a datasource abstraction that can be extended:
  - New table `roadmap_datasources` keyed by `roadmap_id` (recommended).
  - Columns: `type`, `config_json`, `secret_ref`, `created_at`, `updated_at`.
  - `config_json` stores per-type settings (ADO, Jira, etc.), no secrets.
- Extend `RoadmapDetail` (and server payload) to include `datasourceType` and `datasourceConfig` (no secrets).
- Update UI to let users choose datasource and enter settings in a modal from `RoadmapManagerPanel.tsx`.

### 2) Secure storage for PAT
- Add server-only storage for PATs (encrypted DB field or secret store).
- UI submits PAT once; server stores a reference or encrypted value.
- Return only a masked indicator to the client for edits (never the PAT).
- Define PAT rotation/clear flow and ensure logs never include PATs.

### 3) Validation endpoint
- Create `POST /api/roadmaps/[id]/datasource/validate`:
  - Reads the `datasourceType` and type-specific settings from request body.
  - Dispatches to the matching validator (ADO now, Jira later).
  - Returns success/failure and error details (sanitized).
- Allow validation to use stored PAT when the user does not re-enter it.

### 4) Azure DevOps fetch endpoint
- Implement `GET /api/roadmaps/[id]/datasource/items` with handler dispatch:
  - If `azure-devops`, build WIQL query or use saved query ID.
  - Calls `POST https://dev.azure.com/{org}/{project}/_apis/wit/wiql?api-version=7.1-preview.2`
  - Fetches work item details via batch endpoint:
    - `POST https://dev.azure.com/{org}/{project}/_apis/wit/workitemsbatch?api-version=7.1-preview.1`
  - Maps fields to `RoadmapItem`.
  - Chunk IDs per request and cap max items to avoid API limits.

### 5) Mapping strategy
- Default mapping:
  - `title` <- `System.Title`
  - `startDate` <- `Microsoft.VSTS.Scheduling.StartDate` or custom field
  - `endDate` <- `Microsoft.VSTS.Scheduling.FinishDate` or custom field
  - `pillar` <- custom field (e.g., `Custom.Pillar`)
  - `region` <- custom field (e.g., `Custom.Region`)
  - `criticality` <- custom field
  - Others default to empty string
- Define fallback behavior when start/end dates are missing (e.g., skip item or use CreatedDate/TargetDate).
- Provide a mapping UI for advanced users.

### 6) Client loader changes
- Update `loadRoadmap()` to call `/api/roadmaps/[id]/datasource/items` for any non-CSV datasource.
- Keep CSV logic for local `csv_text` when the datasource type is `csv`.
 - On login events, force a refresh for the active roadmap (e.g., by adding a `refresh=1` query param).

### 7) Error handling
- Show validation errors inline in config UI.
- On fetch errors, show a friendly empty state with retry.

### 8) Auditing & logging
- Log validation and fetch errors server-side (no PAT in logs).
- Provide a "Last successful sync" timestamp.

### 9) Rate limits and pagination
- Set a default max work item count per query (e.g., 500) and support paging (continuation token or batched IDs).
- Expose a “Max items” field in the datasource advanced settings and show a hint about API limits.
- If results exceed the limit, return a warning banner and a truncated dataset.

### 10) Mapping validation
- On validate/save, check that mapped fields exist and that date fields parse cleanly.
- Warn if required fields are missing (title/start/end) and block save if critical fields are invalid.
- Provide a sample preview row in the modal so users can confirm the mapping visually.

### 11) Project discovery
- After PAT entry, add a “Load projects” button that calls a server endpoint to list projects.
- Populate a project dropdown from that response to reduce manual typing errors.

### 12) Snapshot fallback
- Store the last successful fetch result and timestamp per roadmap.
- When live fetch fails, return the cached snapshot with a `stale=true` flag.
- Show a warning banner in the UI with “Using cached data from <timestamp>”.

### 13) Sync telemetry
- Persist `last_sync_at`, `last_sync_duration_ms`, `last_sync_item_count`, `last_sync_error`.
- Expose these in the config UI and optionally in an admin/debug panel.

## Validation Logic
- Validate required fields: org URL, project, PAT, query.
- If query is WIQL, run a test WIQL query with `top 1`.
- If query is saved query ID, fetch that query definition.
- Ensure API returns `200` and at least one work item (or allow zero).

## Read-Only Guarantee
- Use PAT with `Work Items (Read)` scope only.
- Implement server-side routes with read-only endpoints.
- No update/patch calls to Azure DevOps.

## Testing Plan
- Unit test mapping functions with sample work item payloads.
- Integration test validation endpoint with mocked ADO API responses.
- UI test for config flow and error states.

## Rollout
- Feature flag Azure DevOps datasource initially.
- Provide documentation for PAT setup and required scopes.
- Ensure existing CSV roadmaps remain default and continue to work with `csv_text`.

## Refresh Strategy (Recommended)
- Default refresh interval: 15 minutes; configurable per roadmap (range 5–60 minutes).
- Manual refresh action available in the UI (roadmap view or manager panel).
- Server-side caching with TTL equal to the configured interval; use stale-while-revalidate to keep UI responsive.
- If no background scheduler exists, document this as on-demand cache refresh (manual or on view load).
- On user login, force a refresh for the active roadmap to ensure fresh data for that session.

## CSV Export (Non-CSV Datasources)
- Provide a “Download CSV” action that exports the current mapped `RoadmapItem[]` to CSV.
- For Azure DevOps, generate CSV on demand from the fetched items (or cached snapshot), without storing it in `csv_text`.
- Use the same CSV header/field order as existing CSV imports to keep consistency.
- Keep the “Download CSV” button in its current location (delete confirmation flow in `src/components/roadmap/RoadmapManagerPanel.tsx`), but switch the backend to use the active datasource when present.
- If live fetch fails, export from the cached snapshot and indicate staleness.
