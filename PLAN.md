# Plan: Saved & Shared Views with Clerk + SQLite

## Goals
- Add authenticated users (Clerk) and persist saved views per user.
- Add shared views with shared access editable in-app by any authenticated user.
- Use SQLite as the storage layer (no external managed DB).
- No change history for now.

## Assumptions
- App will move off Vercel in the mid-term so a local SQLite file is acceptable.
- Low scale: <100 users, 5–10 views each.
- Shared views are not owned by a specific user; any authenticated user can access them.

## Proposed Architecture
- **Auth**: Clerk (OIDC-ready). Use Clerk middleware to protect view APIs.
  - Start with email/password or magic link; enable SSO (SAML/OIDC) later via Clerk.
- **Storage**: SQLite file at `data/roadmap.db` (checked into the repo), accessed via server-side API routes.
- **API**: Next.js route handlers under `src/app/api/views/*` for CRUD.
- **Client**: View manager UI in the header area.

## Data Model (SQLite)
### Table: `views`
- `id` (TEXT, PK)
- `name` (TEXT)
- `scope` (TEXT) — `personal` or `shared`
- `owner_user_id` (TEXT, nullable) — Clerk user id for personal views
- `org_id` (TEXT, nullable) — Clerk org id (future-proofing for org scoping)
- `created_by` (TEXT) — Clerk user id
- `updated_by` (TEXT) — Clerk user id
- `payload` (TEXT) — JSON string of filters + display options
- `created_at` (TEXT, ISO)
- `updated_at` (TEXT, ISO)

### Payload structure (JSON)
- `filters`: pillars, regions, criticalities, stakeholders, groupBy
- `display`: theme, itemStyle, showMonths/showQuarters, etc.
- `timeline`: startDate, quartersToShow

## API Endpoints
- `GET /api/views?scope=personal|shared`
- `POST /api/views` (create new view)
- `PUT /api/views/:id` (update)
- `DELETE /api/views/:id`

Rules:
- Personal views require `owner_user_id = current user`.
- Shared views require authenticated user; no group restrictions yet.
- Shared views set `owner_user_id = null` so they survive user deprovisioning.
- Any authenticated user can rename or delete shared views for now.

## UI/UX
- Add “Saved Views” section in header (collapsed by default):
  - Tabs: Personal | Shared
  - List of saved views with “Load”, “Edit name”, “Delete”.
  - “Save current view” button with name input.
  - “Publish to shared” toggle (creates or updates shared view).

## Implementation Steps
1. **Clerk integration**
   - Add Clerk SDK + middleware
   - Wrap app with `<ClerkProvider>` and gate view routes
2. **SQLite setup**
   - Add `better-sqlite3` for a simple, synchronous API
   - Create schema on startup if missing
3. **API routes**
   - CRUD routes with auth checks
4. **Client view manager**
   - UI in header + API calls
   - Load/save apply view payload
5. **Persist current view state**
   - Replace localStorage persistence with server-backed views
   - Keep localStorage as fallback when offline

## Open Questions
- None for now.
