# Microsoft SSO (M365/Entra ID) Plan

## Goal
Enable single sign-on for company users who authenticate via Microsoft 365 (Entra ID / Azure AD), while keeping Clerk as the auth provider and preserving existing non-SSO auth flows.

## Scope
- Add Microsoft SSO for the company domain(s).
- Use Clerk SSO (SAML/OIDC via Entra ID) as the integration layer.
- Preserve existing local/dev auth and non-SSO login methods (unless explicitly disabled later).
- Ensure roadmap permissions remain server-enforced.

## Assumptions
- Clerk is the current auth provider in the app.
- The company has an Entra ID tenant (Microsoft 365 Enterprise).
- We will map identities by verified email domain(s) and enforce access via roadmap roles as usual.

## Requirements
- Support Clerk authentication (NFR).
- Identity and user directory logic remains provider-based (NFR).
- No breaking changes to existing auth in dev/test.

## Plan

### 1) Entra ID setup (Org / IT)
- Create an Enterprise Application for the roadmap app.
- Choose SSO method:
  - **Recommended**: SAML (Clerk supports SAML for Enterprise SSO).
  - Alternative: OIDC if preferred by IT.
- Capture the following for Clerk:
  - **SAML**: IdP metadata URL or XML, Entity ID, SSO URL, X.509 certificate.
  - **OIDC**: client ID, client secret, issuer URL, discovery URL.
- Define allowed user groups (if the org wants access restricted).

### 2) Clerk configuration (Admin)
- In Clerk Dashboard:
  - Enable **SSO** and create a new **Enterprise Connection** for Microsoft.
  - Configure the connection using the Entra ID values from step 1.
  - Add and verify company domain(s) (e.g., `example.com`) for domain-based discovery.
  - Set SSO mode to **"required for domain"** if desired.
- Configure session settings (timeout, refresh, etc.) as needed.

### 3) App configuration (Code)
- Add environment variables for Clerk SSO if needed (e.g., redirect URLs).
- Confirm app routes support Clerk SSO callback.
- Ensure user identity fields are consistent:
  - Primary key: Clerk user ID.
  - Secondary key: verified email address.
- Ensure all server-side permission checks use the user ID and/or verified email, not client-only assumptions.

### 4) User experience
- Add a login button for **"Sign in with Microsoft"** (if not already provided by Clerk UI).
- If domain discovery is enabled, user types email and gets redirected to Entra ID.
- Ensure shared view links still function for non-members (if allowed).

### 5) Authorization model alignment
- SSO does not grant roadmap access automatically.
- Access rules remain the same:
  - Owners/Editors can manage saved views and roadmap settings.
  - Viewers can view saved views but not modify them.
- Optional: auto-provision based on group membership from Entra ID (future enhancement).

### 6) Testing
- Verify SSO login with a test Entra ID user.
- Verify non-SSO login still works for other users.
- Confirm role enforcement for:
  - Owner/Editor vs Viewer.
  - Shared link access (if enabled).
- Confirm logout, session expiration, and re-login flow.

### 7) Rollout
- Enable SSO for a pilot domain or test tenant.
- Communicate login instructions to users.
- Monitor auth logs for failures.
- Expand to full domain once stable.

## Risks / Notes
- Misconfigured Entra ID claims can prevent email verification in Clerk.
- Domain discovery can block non-domain users if set to "required".
- Role mapping from Entra ID groups is not planned in this phase.

## Deliverables
- Clerk SSO connection configured for Microsoft (Entra ID).
- App supports Microsoft SSO login flow.
- Documentation of domain(s), IdP config, and expected login behavior.

## Open Questions
- Should SSO be required for all users on the company domain?
- Do we need group-based auto-provisioning (owners/editors/viewers)?
- Which domains should be allowed for SSO discovery?
