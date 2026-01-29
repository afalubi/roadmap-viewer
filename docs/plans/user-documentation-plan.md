# Plan: User Documentation & Guides

## Goals
- Provide clear, task-focused guidance for end users, editors, owners, and system admins.
- Reduce support questions by documenting common workflows and permissions.
- Keep docs lightweight, searchable, and easy to maintain alongside product changes.

## Non-goals (for now)
- Full marketing site or public docs portal.
- Multi-language localization.
- Video tutorial production.

---

## 1) Audience & Roles

### Primary audiences
- **Viewer**: reads roadmaps and shared views.
- **Editor**: manages content where permitted (shares, updates).
- **Owner**: full control of a roadmap (share, delete, manage).
- **System Admin**: global user/roadmap visibility and role management.

### Secondary audiences
- **Data admins** managing CSV/ADO data sources.
- **IT/IdP admins** configuring AD/SSO.

---

## 2) Documentation scope

### Core user guides
1. **Getting started**
   - Sign in, landing page overview, finding shared roadmaps.
2. **Viewing roadmaps**
   - Timeline, swimlanes, filters, item detail view.
3. **Using views**
   - Creating views, sharing links, access rules.
4. **Roadmap management (owners/creators)**
   - Create roadmap, switch roadmaps, manage sharing.
5. **Theme editor**
   - Preview themes, set overrides, light/dark preview behavior.
6. **Data sources**
   - CSV import basics, ADO mapping, payload import, validation messages.
7. **Admin panel**
   - Users list, role toggles, audit log, permissions rules.

### Reference content
- **Permissions matrix** (viewer/editor/owner/admin).
- **Glossary** (roadmap, view, share, lane, item style).
- **Troubleshooting** (common errors, missing data, build hints).

---

## 3) Information architecture

### In-app docs placement (proposed)
- Add a **Help** entry in the header (or profile menu).
- Render docs inside the app as a `/help` route with a left-hand nav.
- Reuse markdown content stored in-repo but surfaced in-app.

### Docs structure (proposed)
- `src/app/help/` (in-app docs shell)
  - `page.tsx` (landing + quick links)
  - `docs/` (markdown content rendered in-app)
    - `getting-started.md`
    - `viewing-roadmaps.md`
    - `views-and-sharing.md`
    - `roadmap-management.md`
    - `permissions.md`
    - `editor-workflows.md`
    - `creator-workflows.md`

---

## 4) Content standards

### Style
- Short, task-first steps with numbered actions.
- Minimal jargon; explain terms once in a glossary.
- Use consistent naming for UI elements (match labels in app).

### Format
- “When to use / Steps / Tips / Gotchas” sections.
- Screenshot placeholders (optional for phase 1).
- Code or config snippets only where needed (CSV, ADO mapping).

---

## 5) Source of truth & maintenance

### Sources
- UI text and labels in the app.
- Product decisions in `PRODUCT.md`.
- Architecture and identity notes in `ARCHITECTURE.md`.

### Maintenance workflow
- Add a **Docs checklist** for UI changes (labels, workflows, permissions).
- Keep docs in same repo; update in the same PR as feature changes.

---

## 6) Phased rollout

### Phase 1 (baseline)
- Viewer workflows: finding roadmaps, filters, item details
- Editor workflows: sharing, view creation
- Creator workflows: create/manage roadmap
- Permissions matrix (viewer/editor/owner/admin)

### Phase 2 (admin + data)
- Admin panel
- Data sources + ADO payloads
- Audit log

### Phase 3 (advanced)
- Theme editor deep dive
- Troubleshooting and FAQs
- Glossary expansion

---

## 7) Open questions

- Confirm placement of the Help entry in the header vs profile menu.
- Which workflows are most asked about today (to prioritize)?
 

---

## 8) Deliverables

- Add `/help` in-app docs shell and navigation.
- Create markdown content under `src/app/help/docs/`.
- Initial markdown drafts for viewer/editor/creator workflows.
- Permissions matrix and glossary.
