# Review fixes and final validation — 2026-10-17

All five findings from the main application review are fixed. A sixth issue exposed by the complete browser workflow was also corrected. Final validation passed: 25 unit/security tests, 91 PostgreSQL integration tests, and 19 Edge browser tests — **135 automated tests**, with zero failures or skips in the final runs. The separate combined-image runtime rehearsal and deployment script checks also passed.

Scope: `E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava`, including its existing uncommitted notification implementation. The standalone demo was not changed. Existing database migrations and prior local work were preserved.

## Implemented changes

| Finding | Change | Regression evidence |
| --- | --- | --- |
| Permission downgrades retained private cached data | The authenticated workspace owns a query client keyed by user ID and sorted effective permissions. A changed scope discards its old cache and screen state; an old response cannot enter the new client. | Browser checks cover task/order/defect lists, open task details and image previews, a delayed old response, and unchanged permission sets arriving in a different order. |
| Full Administrator permissions exceeded validation limits | Permission sets and override maps are validated against the known permission registry, which bounds valid distinct keys, without the conflicting limit of 50. | Integration checks edit the seeded Administrator, create a full-permission role/user, reject unknown permissions, and verify failed creation rolls back. Existing last-administrator and authorization checks remain green. |
| Railway notifications direct visits failed | `/notifications` is registered in both the public HTML allowlist and SPA controller mappings. Notifications APIs stay authenticated. | GET/HEAD, default-profile/opt-out, API authorization and CSRF checks pass; the built image supports direct browser visits and reloads. |
| Template version 128 was falsely stale | Boxed version values are compared numerically. | Equal versions 0, 127, 128 and 1024 succeed; stale versions fail; concurrent edits have one winner. |
| Attachment metadata retrieved binary contents | Shared metadata SQL selects only metadata columns. The download path retrieves binary content once after authorization. | A PostgreSQL role with no permission to select `content` can list metadata. Large downloads remain byte-identical. The runtime lists 21 large attachments without loading their payloads into the response. |
| Stock issue could leave parent order actions using an old version | Stock dialogs stay pending until related queries, including the parent order, finish refreshing. Order actions are disabled during refresh. | A deliberately delayed parent refresh keeps the stock dialog open; the next cancellation submits the committed version. The complete manufacturing-order workflow passes. |

Main code locations: [authenticated cache boundary](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/main.tsx:223), [stock synchronization](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/Warehouse.tsx:90), [order actions](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/src/OrdersPage.tsx:84), [permission inputs](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/identity/Administration.java:17), [template version check](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/operations/TemplateService.java:24), [attachment projection](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/files/FileService.java:48), [Railway HTML routes](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/main/java/com/easyback/web/RailwaySpaConfiguration.java:30).

An effective permission change intentionally resets open forms/dialog state when the account refresh observes the change. Normal account refreshes and changes in permission ordering preserve the workspace. Existing account polling remains at 15 seconds while visible, with focus refresh.

## Final checks

| Check | Result |
| --- | --- |
| Backend `docker compose --profile test run --build --rm verify` | BUILD SUCCESS: 25 unit/security tests and 91 integration tests; dedicated `easyback_test` database; no failures/errors/skips. |
| Complete browser suite, `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e` | 19/19 passed in 3.7 minutes. Includes all 12 existing browser workflows and seven new cache/synchronization regressions. |
| Frontend `npm run build` | TypeScript and Vite production build passed. |
| New browser-test TypeScript check | Passed with the installed compiler, `--ignoreConfig --noEmit --module esnext --moduleResolution bundler --target ES2022 --types node --skipLibCheck tests/authorization-cache.spec.ts`. |
| Development API image | Built and the local API restarted with the backend fixes. |
| Final combined Railway image | Built successfully as `easyback-review-railway:20261017`, including the final stock/order synchronization correction. |
| `Deployment-Scripts.Tests.ps1` | Passed mocked checks for environment selection, cleanup, bootstrap modes and development defaults. |
| `git diff --check` | Passed. |

The existing browser suite covers account administration and restrictions, themes/layout at desktop/tablet/mobile sizes, catalog and versioned BOMs, order release and cancellation, stock receipts/reservations/issues/returns, raw cutting/remnants, worker assembly and machine history, defect repair/scrap, notifications, and operations failure/rework/retest/completion/delivery. Browser tests use reserved localhost fixtures and their documented cleanup; workflow/audit history is retained.

Tests were not treated as sufficient merely because they passed before the fixes. The initial full-browser run exposed the stock/order race; it was corrected and protected by a delayed-response test before the final complete suite passed.

New regressions: [browser cache and stock synchronization](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/frontend/tests/authorization-cache.spec.ts), [PostgreSQL regression methods](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/test/java/com/easyback/identity/IdentityIT.java:1438), [Railway security checks](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/backendjava/src/test/java/com/easyback/identity/RailwaySpaSecurityTest.java:84).

## Combined-image runtime rehearsal

The existing rehearsal script now accepts `EASYBACK_RAILWAY_IMAGE` for selecting the image under test and includes the new notification routes and large metadata-list check. It uses a fresh disposable PostgreSQL database, generated test-only secrets, a non-root app container, and a localhost Caddy proxy. It does not read the development `.env` or connect to the development database.

Final observed results:

- All 22 HTML/static deep-link route cases passed their GET/HEAD checks.
- HTTPS API access, secure HttpOnly cookies, CSRF/origin rejection, logout revocation and mandatory first-password change passed.
- Direct notification visits and reloads worked in Edge at 1440 px and 834 px; no application page errors or horizontal overflow were reported.
- Twenty-one attachments, approximately 210 MiB total, produced a **6,752-byte metadata response**. Repeated concurrent large downloads and report requests passed.
- App container limit: **512 MiB**. Initial peak: **415 MiB**. Peak after app recreation: **269 MiB**. No OOM kill occurred.
- Restart without bootstrap credentials preserved identity, the synthetic model, and a **10,485,744-byte attachment**, compared byte-for-byte.
- The script removed its owned containers, network and temporary configuration directory.

Machine-readable result: [fixed-railway-runtime.json](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/output/review/fixed-railway-runtime.json). The notification tablet screenshot is [railway-notifications-834.png](E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava/output/playwright/railway-notifications-834.png); its RTL layout was visually inspected.

To repeat the combined-image check in PowerShell after building the image:

```powershell
$env:EASYBACK_RAILWAY_IMAGE = 'easyback-review-railway:20261017'
node scripts/tests/Railway-Runtime.mjs
```

## Practical limits

This confirms the exercised local workflows and the isolated combined-image rehearsal. Public Railway deployment, company DNS/VPN and trust of the actual production certificate remain outside this local validation. Browser rehearsal traffic uses loopback HTTP because the local self-signed certificate is blocked by antivirus in the browser; HTTPS API checks are performed separately.

The existing approximately 538 kB main JavaScript bundle warning remains non-blocking. The bounded container rehearsal does not establish capacity for arbitrary production traffic or dataset sizes. No application implementation changes remain pending for the reviewed findings.
