# Project Non-Functional Requirements

This file defines non-functional requirements (NFRs) for the roadmap project.
Follow these requirements whenever making changes in this repository.

## Documentation & Planning
- Store new work plans in `docs/plans/` (Markdown).
- Keep NFRs and operational guidance in this file (`NFR.md`).

## Authentication & Identity
- Must continue to support Clerk authentication.
- Keep identity and user directory logic provider-based to allow Azure SSO integration.
- Avoid hard-coding Clerk-specific assumptions in shared interfaces.

## Data Sources
- Keep data-loading logic modular and provider-driven to support new sources (e.g., Azure DevOps).
- Avoid coupling UI to a single data source.

## API & Compatibility
- For now, API changes can be flexible, but prefer backward-compatible changes when reasonable.
- Design new APIs with future tightening of compatibility in mind (clear versioning points, minimal breaking changes).

## Quality & Safety
- Prefer clear permission checks and role enforcement on server and UI.
- Add safeguards that prevent unintended privilege changes.
