# Sharing Redesign Plan (Owner / Editor / Viewer)

## Goals
- Replace the personal/shared split with a role-based sharing model per view.
- Support sharing a view with specific target users and access levels (viewer/editor/owner).
- Provide a user picker backed by a directory search (Clerk now; extensible to SSO sources like Azure AD).
- Enforce permission rules:
  - Owner: full control (update, rename, delete, share).
  - Editor: can update view settings and rename, cannot delete/share above own role.
  - Viewer: can load and adjust local filters but cannot save updates to the view.
  - No user can grant a higher role than their own.
  - Owner cannot demote themselves below owner.

## Scope
- Backend: schema, API endpoints, auth/permission checks.
- Backend: user directory search endpoint and provider abstraction.
- Frontend: views management UI, sharing controls, user picker, action gating.
- Migration: existing personal/shared views and shared links.
- Tests: permission boundary checks and regression tests.

---

## 1) Current State Review (reference)

### Data model (current)
- `views` table with `scope` (personal/shared), `owner_user_id`, `shared_slug`, `payload`, etc.

### API routes (current)
- `GET /api/views?scope=` (list personal/shared)
- `POST /api/views` (create)
- `PUT /api/views/[id]` (rename, update payload, generate slug)
- `DELETE /api/views/[id]` (delete)
- `GET /api/views/slug/[slug]` (fetch shared view by slug)

### UI (current)
- Views dropdown (personal/shared options).
- Manage panel for rename/delete/share/generate link.
- Update active view allowed for current user.

---

## 2) Target Data Model

### Tables

#### `views`
- `id` (uuid)
- `name` (text)
- `payload` (jsonb)
- `created_at`, `updated_at`
- `created_by` (user id)
- `updated_by` (user id)

#### `view_shares`
- `id` (uuid)
- `view_id` (fk views.id)
- `user_id` (fk to auth user)
- `role` (enum: `viewer`, `editor`, `owner`)
- `created_at`, `updated_at`
- `created_by` (user id)
- `updated_by` (user id)
- unique `(view_id, user_id)`

#### `view_links` (optional, with passwords)
- `id` (uuid)
- `view_id` (fk views.id)
- `slug` (text unique)
- `role` (enum: `viewer`, `editor`)  // default viewer
- `password_hash` (text, nullable)
- `created_at`, `updated_at`
- `created_by` (user id)

> Note: If you want link sharing to map to users only, skip `view_links` and implement direct user grants only.

### Permissions
- **Owner**: full rights, can update, delete, rename, share (grant/revoke).
- **Editor**: can update payload and rename; cannot delete; can share only at editor/viewer level.
- **Viewer**: read-only; can load view and apply local filters but cannot save changes.

### Role constraints
- Grant role <= grantor role.
- Owner cannot demote themselves below owner.

---

## 3) API Changes

### Auth & permission helpers
- `getViewRole(userId, viewId)` => `owner|editor|viewer|none`
- `assertRoleAtLeast(userRole, requiredRole)`

### User directory search
- `GET /api/users/search?q=` (server-only)
  - Returns `{ users: [{ id, displayName, email }] }`
  - Backed by a provider (Clerk now, Azure AD/other SSO later)
  - Require auth; scope results to current tenant/org if available

### Views
- `GET /api/views`
  - Returns all views where user has a grant in `view_shares`.
  - Response includes user’s role per view.

- `POST /api/views`
  - Create view.
  - Add `view_shares` record with role `owner` for creator.

- `PUT /api/views/[id]`
  - Update payload and/or rename.
  - Permission: `owner` or `editor`.

- `DELETE /api/views/[id]`
  - Owner only.

- `GET /api/views/[id]`
  - Fetch view by id if user has any role.

### Sharing

- `POST /api/views/[id]/share`
  - Body: `{ userId, role }` or `{ email, role }`.
  - Permission: owner/editor; ensure requested role <= grantor role.

- `PUT /api/views/[id]/share/[shareId]`
  - Update role.
  - Permission: owner/editor; cannot raise above grantor role.
  - Block owner from demoting themselves.

- `DELETE /api/views/[id]/share/[shareId]`
  - Revoke access.
  - Permission: owner/editor; cannot revoke owner’s own role.

- `POST /api/views/[id]/link`
  - Optional link-based sharing with role, slug, and optional password.
  - Permission: owner/editor; role must be <= grantor role.
  - If password provided: store `password_hash` (bcrypt/argon2).

- `POST /api/views/link/[slug]/auth`
  - Verify password for a protected link.
  - Returns a short-lived token/session to access the link.

- `GET /api/views/link/[slug]`
  - Resolve slug; if link is password-protected, require proof (token/session).
  - Map link role to temporary access or add a view_shares record for the user (policy decision).

---

## 4) Frontend/UX Updates

### View list & selector
- Replace personal/shared grouping with role-based badges (Owner/Editor/Viewer).
- Dropdown shows all accessible views with role indicator.

### Manage panel
- Show:
  - Current user role for each view.
  - Share controls if role >= editor.
  - Update/Delete controls gated by role.

### Sharing UI
- Share dialog with:
  - target user picker (typeahead search + email fallback if allowed)
  - role selector (viewer/editor/owner) limited by current user role
  - list of existing shares with role and revoke/edit

### Link sharing UI
- Create link with:
  - role (viewer/editor, limited by current user role)
  - optional password
- Show link status and allow rotation/revoke.
- If passworded, prompt for password on access.

### Action gating
- Viewer: update button hidden/disabled.
- Editor: update + rename enabled, delete disabled.
- Owner: all actions enabled.

---

## 5) Migration Plan

1) Add new tables (`view_shares`, optionally `view_links` with `password_hash`).
2) For each existing view:
   - Create `view_shares` owner record for `owner_user_id` (or `created_by`).
   - If `scope = shared` and `shared_slug` exists:
     - Create a `view_links` row with `role=viewer` and the existing slug.
   - If personal view: no link created.
3) Update list endpoints to return only views where user has a share.
4) Remove `scope` usage in UI, keep temporarily for migration safety.
5) After validation, deprecate `scope` and `shared_slug` fields (optional later cleanup).

---

## 6) Testing & Validation

### Unit tests
- Role resolution: owner/editor/viewer/none.
- Permission checks: update, rename, delete, share.
- Role escalation prevention.
- Owner self-demotion prevented.
- Link password verification (success/fail).
- User directory search returns stable shape and respects auth/tenant boundaries.

### Integration tests
- Create view -> owner grant.
- Editor can update and rename but not delete.
- Viewer can load but not update.
- Share link with role constraints and optional password.
- Share dialog user search works (typeahead -> select -> share).

### UX validation
- Buttons correctly enabled/disabled per role.
- View dropdown indicates role.
- Share modal respects role limits.
- Password prompt shown for protected links.

---

## Open Questions
- Should link access create a persistent user grant, or remain ephemeral?
- Do we allow unauthenticated access to viewer links if passworded?
- Should owners be able to lock renames even for editors?
- Should we allow email-only shares when the user is not found in the directory?

---

## Next Steps (if approved)
1) Implement schema changes and migration.
2) Update API permissions and routes.
3) Update UI and view management.
4) Add tests and validate.
