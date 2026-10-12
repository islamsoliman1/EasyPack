# EasyPack - Manufacturing Management System

A full-stack manufacturing workflow application covering machine components,
warehouse stock, assembly tasks, defect handling, operational trials and manager
reporting. Built with Java 21, Spring Boot, PostgreSQL, React and TypeScript,
with an Arabic RTL interface for desktop and tablet use.

The active implementation is **`backendjava/`** (Java 21, Spring Boot, PostgreSQL)
and **`frontend/`** (React, TypeScript, Vite). This directory contains the standalone Java/React project.
Run all commands below from this repository's root.

## Implemented Deliveries

- Real email/password login, BCrypt hashes, signed 15-minute access tokens in memory.
- Seven-day database sessions, rotating hashed refresh tokens in HttpOnly cookies,
  replay detection, logout revocation, and immediate account-disable revocation.
- Mandatory password change for new/reset accounts; reset revokes all sessions.
- Users, editable roles, explicit allow/deny overrides (deny overrides role grants).
- Server-side authorization, CSRF protection for cookie endpoints, login throttling,
  optimistic version checks, audit records, and serialized last-administrator protection.
- Arabic RTL React screens for login, profile/password, users and roles; search,
  pagination, validation, permission-aware navigation, error states, desktop/tablet layout.
- Machine models, physical machines, shared part definitions (serialized-ready or measured raw material).
- Explicit millimetre dimensions by shape, stock-unit category and default installation minutes.
- Versioned BOM drafts, repeated part positions, quantity and installation time, immutable publication,
  and new drafts cloned from published revisions. Optimistic conflicts, authorization and audit recording.
- Matching React catalog/machine/BOM screens, EPE / EasyPack identity and light/dark appearance.
- Optional atomic model linking while creating a part; independent parts lists for each physical machine,
  with empty drafts or one-time copies of published model revisions. Changes never propagate to sibling machines.
- Manufacturing order drafts, responsible account and delivery date, frozen requirement snapshots on release,
  cancellation with reason, separate permissions and assigned-only order access. See `docs/ORDERS_STATUS.md`.
- Serialized warehouse receipts/balances/history, automatic reservation at release, issue and inspected returns,
  quarantine/restoration and shortage preparation. See `docs/WAREHOUSE_STATUS.md`.

- Measured raw-unit receipts/balances/history, issue to preparation, length/sheet cutting, serialized output,
  reusable remnants and actual scrap, with zero calculated kerf. See `docs/RAW_STOCK_STATUS.md`.

- Per-occurrence worker assignments, task-scoped access, issued-serial binding, installation/removal history,
  physical machine configuration versions and assembly progress. See `docs/ASSEMBLY_STATUS.md`.

- Worker defect rejection, physical defective receipt, manufacturing repair, warehouse acceptance and irreversible scrap,
  with serial history and separate permissions. See `docs/DEFECTS_STATUS.md`.

Operations trials, failure/rework/retest, successful order completion and separate actual delivery
are implemented; see [Operations status](docs/OPERATIONS_STATUS.md). Work calendars,
task work sessions, scoped attachments, reusable trial checklists and manager
CSV/print reports are also implemented; see [Pilot status](docs/PILOT_REMAINING_STATUS.md).
Department roles start without operational permissions. No demo authentication or fake stock is used.
See `docs/CATALOG_STATUS.md` for API routes, rules and boundaries of the catalog delivery.

## Run Locally (PowerShell)

Requires Docker Desktop (Linux containers) and Node.js 22.12+; local Maven is optional.

```powershell
./scripts/Initialize-Development.ps1
docker compose up -d --build postgres api
cd frontend
npm ci
npm run dev
```

Web: <http://localhost:5173>. API: <http://localhost:18080/api/v1>.
Health: <http://localhost:18080/actuator/health>.
Development API documentation: <http://localhost:18080/swagger-ui/index.html>.
Set `API_PORT` for a different API port and `EASYBACK_API_URL` for the matching Vite proxy target.

Alternatively run `./scripts/Start-Frontend.ps1` from the Java project root (`Easypackjava/`) for a hidden
background dev server. It selects the next free port when 5173 is occupied.

The generated bootstrap email and password are in root `.env` (ignored by Git).
They are used only when the database has no users. The UI requires changing that password
on first sign-in. Do not share or commit `.env`; keep a password-manager copy.
Changing `.env` later does not reset an existing account. Reset through another administrator.

## Verify

```powershell
docker compose --profile test run --build --rm verify
cd frontend
npm run build
npx playwright install chromium
npm run test:e2e
```

Java integration tests use the separate `test-postgres` database. Browser tests use the
running local development app and create pilot accounts and a custom role. Teardown
disables accounts matching the reserved test email/name patterns, including interrupted runs.
The catalog workflow creates records using reserved E2E codes and archives those records afterward.
The manufacturing workflow cancels its reserved E2E orders and disables its test responsible account after testing.
The raw-stock workflow returns any issued fixture sources, cancels fixture orders and archives its catalog records.
Physical source/remnant stock, cut provenance and movement history are retained, including archived fixture definitions.
Assembly fixtures are uninstalled and returned before cancellation; worker accounts are disabled and installation history retained.
Defect fixtures are physically received and disposed before cancellation; defect/repair/scrap history and serial identities remain.
The browser suite is restricted to localhost; audit records, test BOM history and test roles are retained.
Do not point browser tests at a production database. Set `EASYBACK_WEB_URL` for a different
frontend port. Screenshots are under `frontend/test-results/`. Traces are disabled to avoid
recording credentials. Test files themselves do not embed development credentials.
For an installed Edge browser, set `PLAYWRIGHT_CHANNEL=msedge` instead of downloading Chromium.

## Deployment Boundary

Implemented Pilot software includes shifts/work sessions, scoped attachments, reusable trial templates
and manager CSV/print reports. See `docs/PILOT_REMAINING_STATUS.md` for rules and acceptance boundaries.
Prepared company deployment: `deploy/compose.yaml`, `deploy/Dockerfile.web`, `deploy/Caddyfile`.
Backup/isolated restore and configuration checks: `scripts/Backup-Database.ps1`, `scripts/Verify-Restore.ps1`,
`scripts/Test-ProductionConfig.ps1`. Follow `docs/DEPLOYMENT_RUNBOOK.md`; these files do not change company DNS/VPN.

Compose is **local development only**: services bind to loopback, HTTP cookies are explicitly
enabled for localhost, and Swagger is enabled. This is not a production deployment.
Before company use: HTTPS and secure cookies, same-origin reverse proxy, production secrets,
backups and restore tests, VPN/remote-access policy, MFA for privileged remote accounts,
monitoring and deployment hardening. Do not expose PostgreSQL or this dev server to the Internet.
No Kubernetes is needed for this pilot. No DNS changes to `easyback.com` have been made.

Schema migrations: `backendjava/src/main/resources/db/migration/`.
Persistence uses Spring JDBC and explicit PostgreSQL transactions/locks with Flyway;
there is no in-memory production adapter. Public requests/responses are DTO records.
See `docs/EASYBACK_IMPLEMENTATION_PLAN_AR.md` and `docs/PILOT_SCOPE_AR.md` for scope and deferred work.

## Railway Demo

A separate combined React/Spring Boot image is defined in `Dockerfile.Railway`
and `railway.json`. Follow [Railway runbook](docs/RAILWAY_RUNBOOK.md) for an
isolated database, private bootstrap credentials and deployment verification.
Railway deployment and the combined image's runtime checks are not yet complete.
Never publish company data, environment secrets, backups or unreviewed screenshots.
