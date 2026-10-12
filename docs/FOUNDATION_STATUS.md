# Java / React Pilot Status

Verified on 2026-10-12. Active backend: `backendjava/`. Active frontend: `frontend/`.

Project root is now `Easypackjava/` inside the original workspace. Backend, frontend,
Compose, scripts, documentation and private environment configuration are all inside it.
Relative paths and commands in this document refer to that Java project root.

## Implemented

- Spring Boot / Java 21, PostgreSQL 17, Flyway migrations, transactional Spring JDBC persistence.
- Signed access tokens; database sessions; hashed rotating refresh tokens; replay revocation.
- Login, logout, forced initial/reset password changes, self-service password changes.
- Users, custom roles, explicit permission overrides, live server-side permission checks.
- Serialized last-administrator protection, optimistic version conflicts, security audit records.
- Arabic RTL React administration, validation, search, pagination and responsive navigation.
- Reference EPE / EasyPack visual identity, flat crimson logo and favicon, shared color tokens.
- Light default and optional dark appearance with persisted preference; no external font or image requests.
- Current CSRF tokens fetched before cookie-authenticated login, refresh and logout requests.
- Machine models, physical machines and shared ready-made/raw-material catalog definitions.
- Explicit dimensions, installation minutes, archive state and optimistic updates.
- BOM drafts and immutable published revisions, repeated positions and cloning into new revisions.
- Independent BOM revisions per physical machine, optional snapshot copy from its model, and atomic new-part/model linking.
- Backend factory permissions, transactional catalog writes, audit events and matching React screens.
- Manufacturing request drafts, frozen release, responsible account, delivery date and reasoned cancellation.
- Order-level assigned-only access, dedicated transition permissions and request list/detail/form screens.
- Serialized warehouse stock, transactional receipt/reservation/issue/returns, quarantine, movement history and shortage queue.
- Measured raw sources/remnants, receipt/issue/return, zero-kerf cutting, atomic serialized output and actual scrap.
- Per-occurrence multi-worker assignment, own-task scope, worker-bound issue, install/uninstall history and configuration versions.
- Order assembly progress through `IN_PROGRESS` to `AWAITING_TESTING`, never automatic completion.
- Worker rejection, physical defective receipt, serial-preserving repair, warehouse repaired receipt and irreversible scrap with case history.
- Operations-only department access, configurable trial checks/criteria, immutable installed-serial snapshots and configuration-version validation.
- Trial failure/abortion/invalidation, documented resolution and new trials; success alone completes the order, followed by separate actual delivery.
- Configuration changes from any order invalidate running machine trials; completed undelivered machines preserve their tested configuration.
- Cairo work calendar, Saturday-Thursday defaults, reasoned Friday exceptions/20:00 extensions, explicit break approval and pause/resume work sessions.
- Scoped PDF/image attachments, reusable Operations templates and manager reports with CSV/browser print.
- Separate private-HTTPS deployment configuration and database backup/isolated restore scripts. See [PILOT_REMAINING_STATUS.md](PILOT_REMAINING_STATUS.md).

## Verification

- 17 unit tests and 79 real-PostgreSQL integration tests passed; Java BUILD SUCCESS in 3:04, including V12 migration.
- 11 real-browser tests passed in Edge: full administration, restricted deactivate-only access,
  responsive branding/theme persistence, authenticated screens/forms in both themes, blocked-storage fallback,
  the model/machine/catalog/BOM lifecycle, manufacturing requests with assigned-only access, and serialized
  receipt, reservation, issue, defective return, restoration, shortage preparation and sheet/round-bar cutting with remnants,
  plus two-worker task isolation, recipient selection, full assembly, removal, return/reissue and machine history,
  and worker rejection, repair acceptance, same-serial reinstallation, terminal scrap and defect history,
  plus Operations-only access, failure/resolution, invalidation/reassembly/retest, successful completion and separate delivery.
- 107 automated tests passed in total (96 Java and 11 existing browser tests). Deployment PowerShell mock checks also passed separately.
- React production build passed.
- Docker API image rebuilt and development API restarted; V12 applied successfully to development and test databases. Earlier verification covered V10/V11.
- Production web image built and Caddy configuration validated without deploying it to the company network.
- Development backup and isolated restore from a different working directory with an explicit environment file passed: V12, 48 orders and one attachment, including attachment integrity checks; the live database was not replaced.
- Fresh isolated production-Compose rehearsal passed with the non-superuser application role and final API image: missing bootstrap values fail closed on an empty database, valid first boot creates one administrator, and restart without credentials is healthy with identity/password hash/version unchanged.
- Production-configuration backup/restore passed with an explicit env file and `DatabaseAdmin easyback_admin`: V12, zero orders and zero attachments. Temporary Docker resources and the generated secret environment file were removed. Company network/VPN acceptance is still required.
- OpenAPI endpoint responds with a valid document; final `Invoke-RestMethod http://localhost:18080/actuator/health` check confirmed UP. `docker compose --profile test stop test-postgres` completed with exit 0 and the service Stopped; no execution sessions remain.
- Desktop, tablet and mobile screenshots inspected; tablet brand wrapping corrected.
- Role permission list scrolls independently so its save action remains visible with the new permissions.
- Text/status token contrast checked in both themes; logout returns 204 and remains logged out after reload.
- Operations screenshots inspected at desktop/tablet/mobile sizes, including failed-check and dark handover forms.
- Non-blocking Vite main-chunk warning remains (approximately 531 kB); new Pilot pages and Operations, defects, assembly and raw stock are lazy-loaded.
- Astra's read-only plan, Sol6.1's five bounded fixes, final production web image build and passing real-data report filtering/search/export/print CLI checks are summarized in [PILOT_REMAINING_STATUS.md](PILOT_REMAINING_STATUS.md). CLI/manual and PowerShell checks are separate from the 107 automated tests.

The tests verify authorization denial, privilege-assignment restrictions, session revocation,
refresh replay, duplicate emails, stale versions and concurrent last-administrator protection.
The test database is separate. Browser tests mutate only the localhost development application.

## Not Yet Implemented

Post-completion corrective work and actual company-server deployment remain outside this delivery. The shifts,
template editor, drawings/uploads and reports are implemented; company acceptance values/breaks are not invented. Defect/repair/scrap boundaries are documented in
[DEFECTS_STATUS.md](DEFECTS_STATUS.md); trial/rework/completion/delivery boundaries are in
[OPERATIONS_STATUS.md](OPERATIONS_STATUS.md). Acceptance criteria are entered per trial, not invented by the system.

This is a locally verified pilot, not a company production release. HTTPS/VPN/MFA setup, encrypted off-host
backup policy, company restore rehearsal, monitoring and server acceptance remain deployment prerequisites.
No changes were made to company DNS or to the preserved .NET/Angular prototype.
EasyPack is the display brand from the approved reference; existing EasyBack account data,
API identifiers and infrastructure names are unchanged.
Catalog rules, endpoints and next delivery are detailed in [CATALOG_STATUS.md](CATALOG_STATUS.md).
Manufacturing request rules, permissions and boundaries are in [ORDERS_STATUS.md](ORDERS_STATUS.md).
Serialized stock and preparation rules are in [WAREHOUSE_STATUS.md](WAREHOUSE_STATUS.md).
Measured sources, cutting rules and boundaries are in [RAW_STOCK_STATUS.md](RAW_STOCK_STATUS.md).
Worker scope, installation/removal and assembly progress are in [ASSEMBLY_STATUS.md](ASSEMBLY_STATUS.md).
