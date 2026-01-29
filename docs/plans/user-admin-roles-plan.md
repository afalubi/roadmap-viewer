# Plan: System Admins & User Management (MS AD-first)

## Goals
- Introduce a **System Admin** role with global visibility and management powers.
- Allow admins to grant **roadmap creation** rights (owner capability) to specific users.
- Preserve per-roadmap sharing (owner/editor/viewer) for access control.
- Default new users to **viewer-only** (no roadmap creation, no global access).
- Make **Microsoft AD** the long‑term identity provider (IdP) without reworking the authorization model later.

## Non-goals (for now)
- Full RBAC UI beyond admin/creator toggles.
- Automated AD provisioning (future phase).
- Bulk import or SCIM sync (future phase).

---

## 1) Role model (proposed)

### Global roles (new)
- **system_admin**: can view all users and all roadmaps; can grant creator rights and manage sharing.
- **creator**: can create roadmaps and becomes owner of newly created roadmaps.
- **viewer**: default for all users; can only see roadmaps shared with them or view links.

> Note: “creator” is a **capability**; keep per-roadmap roles (owner/editor/viewer) unchanged.

### Per-roadmap roles (existing)
- **owner**: full access to a roadmap (edit, share, delete).
- **editor**: edit + view (no delete).
- **viewer**: read-only.

### Role precedence
- If `system_admin = true`, treat as owner for all roadmaps in server checks.
- If `creator = true`, user can create roadmaps and will be set as owner on creation.

---

## 2) Identity + data model changes

### New table: `users`
- `id` (PK, internal UUID)
- `idp` (string enum: `clerk` | `azure_ad`)
- `external_id` (string, IdP subject identifier; e.g., Azure AD object id)
- `email`, `display_name`
- `created_at`, `updated_at`

### New table: `user_roles` (or add to `users`)
- `user_id` (FK -> users.id)
- `is_system_admin` (boolean, default false)
- `can_create_roadmaps` (boolean, default false)
- `created_at`, `updated_at`

### Default behavior
- On first sign‑in, upsert `users` by `external_id`.
- Ensure `user_roles` exists with both flags false.

### IdP abstraction
- Introduce an `IdentityProvider` interface (e.g., `getCurrentUser()`, `getUserByExternalId()`).
- Provide an MS AD implementation (OIDC) and keep a Clerk adapter only if needed short‑term.

---

## 3) API changes

### Admin endpoints (new)
- `GET /api/admin/users`
  - Returns all users with roles + counts of roadmaps shared/owned.
  - **Guarded** by `system_admin`.

- `PUT /api/admin/users/:id/roles`
  - Update `is_system_admin` / `can_create_roadmaps` flags.
  - **Guarded** by `system_admin`.

### Roadmap endpoints (update)
- `POST /api/roadmaps`
  - Require `system_admin` **or** `can_create_roadmaps`.

### Sharing endpoints (update)
- If caller is `system_admin`, allow share management for any roadmap.

---

## 4) UI changes

### Admin panel (new)
- Add **Admin** entry in header for system admins only.
- Admin page: list users, roles, and basic metadata.
- Toggle controls:
  - System Admin
  - Can Create Roadmaps

### Roadmap creation gating
- Hide/disable “Create roadmap” UI unless `system_admin` or `can_create_roadmaps`.

---

## 5) Microsoft AD (primary IdP) plan

### Claims-based mapping
- Map AD group claims to local flags (initially via config):
  - `roadmap_admins` → `is_system_admin = true`
  - `roadmap_creators` → `can_create_roadmaps = true`
- Implement mapping in auth middleware or user provisioning hook.
- **AD claims override local flags.**

### Backfill strategy
- If AD claims are present, **override** local flags.

### Dual-IdP transition (Clerk → MS AD)
- Support both IdPs in parallel via the `IdentityProvider` interface.
- **No identity linking required.** AD users will have separate user ids and must be explicitly granted roadmap access.
- Prefer **email match** only for admin convenience (search/filter), not for linking.
- Phase plan:
  1) **Dual sign-in** (Clerk + AD), assign roadmap access per user.
  2) **AD-preferred** (UI nudges AD, keep Clerk fallback).
  3) **AD-only** (disable Clerk sign-in).
- Add a phased rollout dashboard showing AD vs Clerk usage and unassigned AD users.

### Admin-managed access assignment
- Add access management inside the **Admin** page.
- Provide search/filter by email and IdP.
- Allow **system admins only** to assign roadmap ownership/creation rights to AD users.

---

## 6) Permissions matrix (summary)

| Capability | Viewer | Creator | System Admin |
|------------|--------|---------|--------------|
| View shared roadmap | ✅ | ✅ | ✅ |
| Create roadmap | ❌ | ✅ | ✅ |
| Manage sharing on owned roadmap | ❌ | ✅ | ✅ |
| Manage sharing on any roadmap | ❌ | ❌ | ✅ |
| View all users & roadmaps | ❌ | ❌ | ✅ |

---

## 7) Implementation steps

1. **Schema**: add `users` + `user_roles` tables + migration guard in `ensure...Schema`.
2. **Identity layer**: add `IdentityProvider` interface + MS AD implementation (OIDC).
3. **Role utilities**: helper to read `user_roles` and enforce admin/creator checks.
4. **API**: add admin endpoints + update roadmap creation + sharing checks.
5. **UI**: admin panel + gating for create roadmap.
6. **Docs**: update README or internal docs with role behavior.

---

## 8) Open questions

- Do we want **creator** users to see a list of all roadmaps they don’t have access to? (Assumed no.)
- Should system admins be able to impersonate users? (Assumed no.)
- Confirm Clerk remains active for existing users until AD-only cutover.

---

## 9) Risks & mitigation

- Risk: admin endpoints exposed without strict checks → enforce on server + add tests.
- Risk: confusion between creator and owner → document clearly in UI.
- Risk: AD claim mapping changes roles unexpectedly → log changes + optional audit trail.
- Risk: migration from Clerk to AD breaks identity mapping → keep `external_id` stable and support a one‑time mapping UI.
