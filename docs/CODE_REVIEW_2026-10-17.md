# Main application code review — 2026-10-17

Follow-up: all five findings below were implemented and validated on 2026-10-17. A stock/order refresh race discovered during validation was also fixed. See [implementation and final validation](REVIEW_FIXES_VALIDATION_2026-10-17.md). The original review and reproduction evidence below are retained as the pre-fix record.

Scope: the current working tree at `E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava`, based on commit `d8e3b22`, including the existing uncommitted notification implementation. The standalone public demo and legacy .NET/Angular applications are excluded, as requested. Review covered backend services/controllers, DTOs, identity/access control, V1–V13 migrations, React screens and API/cache handling, and build/deployment/backup scripts. The application contains 50 Java source files and 24 frontend source files.

Five actionable findings: one P1 and four P2. Four were reproduced; the attachment-query finding is confirmed by source inspection. P1 means fix before company use; P2 means a functional or operational defect to fix in the next patch. This is a broad correctness review, not an exhaustive security certification or a production load test. Application source was not changed by this review.

## Findings, in priority order

### 1. P1 — Permission downgrades leave other people's data in scoped screens

Sources: [task query and scope](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/Assembly.tsx:30), [order query](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/OrdersPage.tsx:44), [defect query](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/Defects.tsx:24), [periodic account reload](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/main.tsx:204).

When a logged-in user changes from global access to assigned-only access, `/auth/me` updates the user and the screen heading, but existing resource queries retain the same keys. They remain enabled, and their cached rows are neither removed nor refetched because the authorization scope changed. The table also does not filter its cached global result to the new scope. Related cached detail queries have the same problem. The notification cache already includes permissions in its key, but the older workflow caches do not.

Reproduction: in an isolated Edge browser with synthetic API responses, open `/tasks` with global task/order access and a task belonging to another worker. Return only `tasks.view-assigned` and `orders.view-assigned` from the next account reload. The heading becomes “مهامي”, while the other worker's part remains visible. Result: `stalePrivateRow=true`, `taskRequests=1`. The scoped API response was configured to return no tasks if requested, but no second task request occurred. Screenshot: [permission-downgrade.png](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/output/review/permission-downgrade.png).

Impact: browser views continue displaying data outside the user's current scope. This is a client-cache defect; the existing server-side authorization tests still reject newly unauthorized requests.

Fix: include user identity and effective authorization scope in scoped list/detail cache keys, or explicitly cancel/remove affected caches and remount scoped views when effective permissions change. Avoid carrying previous-scope data into the new query's placeholder state. Cover tasks, orders, defects and their related detail/attachment views consistently. If using query cancellation, propagate the query's abort signal through the API wrapper so an old response cannot repopulate a new scope.

Acceptance: while keeping the browser tab and an open detail view alive, downgrade global access to assigned-only. Other users' rows and details disappear immediately when the account reload observes the change; the new scoped request runs; a late old-scope response cannot restore them. Retain server 403/404 assertions and account-switch isolation tests.

### 2. P2 — The Administrator role cannot be saved with its existing permissions

Sources: [RoleInput and override limits](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/identity/Administration.java:19), [permission registry](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/identity/Permissions.java:10).

The registry contains 51 valid permissions, and bootstrap grants all 51 to Administrator. `RoleInput.permissions` permits at most 50. Editing only the Administrator description and submitting the unchanged permission list fails Bean Validation before the service runs. A user cannot configure explicit overrides for all 51 capabilities either, because the override map has the same limit.

Reproduction: the isolated PostgreSQL probe fetched the seeded Administrator, confirmed 51 permissions, and submitted them unchanged with an updated description and the correct version. Response: HTTP 400, `VALIDATION`.

Fix: remove the conflicting fixed limit or replace it with a bounded validation strategy that accommodates the permission registry. Keep `Permissions.validate`, unknown-permission rejection, assignment authorization and last-administrator protection. Update the override-map limit at the same time.

Acceptance: the full permission set can create/update a role; changing only the seeded Administrator description succeeds; a map covering every known permission is accepted when otherwise authorized; unknown permissions still fail and the last full administrator remains protected.

### 3. P2 — Notifications fail on a direct Railway visit or browser reload

Sources: [public page allowlist](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/web/RailwaySpaConfiguration.java:34), [SPA controller mappings](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/web/RailwaySpaConfiguration.java:53), [React notifications route](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/main.tsx:197).

React implements `/notifications`, but neither Railway's public HTML page allowlist nor its index controller mapping includes that route. Client-side navigation works after loading another page; opening the URL directly or reloading it never loads the frontend. A normal browser navigation does not attach the in-memory bearer token.

Reproduction: with the existing Railway MockMvc fixture and security filters, `/reports` returned 200, while `/notifications` returned 401 without a bearer and 403 with a valid bearer.

Fix: add `/notifications` to both HTML route registrations. Prefer a shared route definition to prevent future drift. Preserve authentication on `/api/v1/notifications/**` and the existing public HTTP-method restrictions.

Acceptance: GET and HEAD `/notifications` serve the SPA under the Railway profile, including a logged-out direct visit; the app then performs normal authentication. Notifications APIs remain protected. Default profile and explicit SPA opt-out remain closed.

### 4. P2 — Checklists become uneditable at version 128

Source: [template optimistic version comparison](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/operations/TemplateService.java:23).

The queried `version` is a boxed `Long`, and `TemplateController.Input.version()` also returns `Long`. `version != p.version()` therefore compares object identity. Cached small values mask the error; matching values at 128 and above can be different objects, producing a false `STALE_VERSION`. Normal repeated edits eventually reach this state, and reloading cannot resolve it.

Reproduction: create a checklist in the isolated test database, set its stored version to 128 to represent accumulated edits, and PUT its existing content with version 128. Response: HTTP 409, `STALE_VERSION`.

Fix: compare primitive `long` values or use value equality, following the role version-check pattern already used in `Administration`.

Acceptance: equal versions 0, 127, 128 and a larger value update successfully; a truly stale version fails; two concurrent updates still have one winner.

### 5. P2 — Attachment metadata queries also retrieve every file's binary content

Sources: [metadata listing](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/files/FileService.java:50), [single-file metadata](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/files/FileService.java:54), [download query](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/files/FileService.java:58).

Both metadata queries use `SELECT f.*`, which includes `resource_files.content`. The mapper ignores that field, but PostgreSQL still returns it to the JDBC client. Opening an attachment list therefore retrieves all matching binary files even though the JSON contains only metadata. Downloads first retrieve content through `metadata()` and then fetch it again with `SELECT content`.

Impact: metadata request size grows with total attachment bytes, rather than the number of small metadata records. Twenty 10 MiB attachments imply roughly 200 MiB of binary data returned by a single listing query. This is particularly concerning for the Railway image's 256 MiB heap. A production memory failure was not load-tested during this review.

Fix: select only the explicit metadata columns in `list()` and `metadata()`. Fetch content only in the authorized download path, once. Preserve permission checks, deletion filtering, safe headers and duplicate-content rules.

Acceptance: attachment listings do not project `content`; listing latency/memory remain small with multiple large files; authorized downloads return byte-identical content; unauthorized/deleted files remain inaccessible.

## Fix plan

| Order | Work | Completion evidence |
| --- | --- | --- |
| 1 | Fix authorization-aware workflow caches across lists and details. | Real-browser downgrade and delayed-response regressions; existing API access tests pass. |
| 2 | Correct permission collection bounds and template value comparison. | Full Administrator round-trip and versions 127/128 regressions pass; last-admin/concurrency checks remain green. |
| 3 | Register the notifications HTML route in Railway. | GET/HEAD direct-link checks pass with existing security-boundary checks. |
| 4 | Remove binary columns from attachment metadata queries. | Query inspection, large-file listing check and download-integrity regression pass. |
| 5 | Run the full verification suite after those patches. | Backend `clean verify`, frontend production build and existing browser workflows pass; repeat the targeted regressions on the patched code. |

Use focused patches so each behavioral change is reviewable. Keep existing V1–V13 migrations intact; these fixes do not inherently require rewriting database history. Promote the isolated review probes into normal regression tests with assertions for the corrected behavior.

## Verification performed

- `docker compose --profile test run --build --rm verify`: BUILD SUCCESS; 25 unit/security tests and 88 PostgreSQL integration tests passed, with no failures/errors. The dedicated `easyback_test` database was used.
- `npm run build`: TypeScript and Vite production build passed. The existing bundle-size warning remains: approximately 538 kB for the main JavaScript bundle before gzip.
- `scripts/tests/Deployment-Scripts.Tests.ps1`: mocked deployment checks passed, including explicit environment selection, cleanup, bootstrap modes and development defaults.
- Three additional backend probes, in an ignored copied source tree, reproduced the role, Railway-route and template-version defects. Their successful assertions describe the observed bugs, not corrected behavior.
- An isolated headless Edge browser with synthetic API responses reproduced the permission-downgrade cache defect. No real user credentials or business records were used for that check.
- Application implementation files and pre-existing uncommitted changes were preserved. Review probes and the screenshot are under ignored `output/review/`; this report is the only new non-ignored file added by the review.

The existing 12 browser workflow tests were not rerun. This review did not validate company DNS, VPN, certificate trust, live Railway behavior, dependency advisories or production-scale load. Existing test success should not be interpreted as coverage of the five findings above.

## Follow-up improvements after the bugs

- Introduce server-side pagination for stock, movement and task lists; current browser pagination still fetches complete datasets.
- Batch report-time aggregation and related order/BOM reads; current services perform many per-record queries. Measure representative pilot volumes before changing behavior.
- Measure contention before replacing the global security/catalog guards, which currently serialize many otherwise independent writes. Preserve their correctness guarantees during any optimization.
- Centralize authorization-aware query-key construction and route registration to reduce repeated policy definitions.

These are maintainability/capacity improvements, not additional reproduced correctness defects.
