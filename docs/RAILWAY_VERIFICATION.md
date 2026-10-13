# Local Railway Rehearsal

Verified 2026-10-13. This records local tests, not a deployment to Railway or the
company server. No GitHub push, cloud database, public domain or paid upgrade
was performed during this verification.

## Automated Checks

- Java: 25 unit/security tests passed, including the eight Railway tests.
- Real PostgreSQL: 79 integration tests passed; Maven `verify` finished successfully.
- Edge: all 11 existing browser tests passed on the local development application.
- Total: 115 automated tests. The runtime rehearsal and PowerShell checks below
  are separate and are not included in that total.
- React production build passed. The existing approximately 531 kB main-chunk
  warning remains non-blocking.
- Final combined Docker image built successfully with the HEAD fix included.
- Railway staging safety tests and deployment script mock checks passed.
- `git diff --check` passed.

## Correction Found

The first executed Railway security suite found that the SPA controller's HEAD
response retained the index body in MockMvc. The controller now explicitly returns
no body for HEAD while preserving GET-equivalent content type and length. The
regression test checks those headers for every allowed page and UUID detail route.
The complete Java suite passed after the correction.

Other initial failures were environmental: a temporary Maven DNS failure and a
stopped Vite server. After restoring the prerequisites, both suites passed.

## Isolated Combined Image

`node scripts/tests/Railway-Runtime.mjs` passed using an empty PostgreSQL 17
database, generated test-only secrets, a non-root application container and a
local Caddy TLS proxy. No existing database or `.env` was used.

- Runtime user/group: `10001:10001`; memory and memory-plus-swap limit: 512 MiB.
- The application honored a non-default PORT (8087).
- Database readiness, Flyway migrations and 21 SPA routes passed GET/HEAD checks.
- Built JS/CSS and the brand image loaded. Unknown APIs/pages, malformed IDs,
  missing assets, environment paths and disabled docs never returned the SPA.
- HTTPS API requests verified security headers, Secure/HttpOnly/SameSite refresh
  cookies, CSRF rejection, untrusted-origin rejection and forced password change.
- Synthetic catalog writes, a 10,485,744-byte PDF fixture and repeated six-request
  report/download batches passed. This is a bounded smoke workload, not a capacity
  test for 100 simultaneous workers. The PDF is a synthetic byte-validation fixture,
  not a test of document rendering or malware detection.
- Refresh/logout passed; logout invalidated the issued bearer session.
- Recreating the app without bootstrap variables preserved the owner, model and
  exact attachment bytes in the still-running disposable database.
- Final rehearsal peak: 419 MiB before recreation, 239 MiB after recreation;
  neither container was OOM-killed. Production workloads still require monitoring.

## Browser Boundary

Kaspersky prevented Edge from opening the local self-signed HTTPS site. This was
confirmed by its warning-page screenshot. Antivirus settings and machine trust
stores were not changed.

The combined frontend was therefore checked over loopback-only HTTP separately
from the HTTPS API checks. Browser login, shift navigation, report deep-link
reload/session restoration, logo loading and desktop/tablet rendering passed at
1440x900 and 834x1112, with no JavaScript errors or horizontal page overflow.
The screenshots were visually inspected and are ignored local artifacts under
`output/playwright/railway-browser-1440.png` and `railway-browser-834.png`.

Browser HTTPS acceptance against Railway's real public certificate remains
outstanding. The rehearsal's extra loopback HTTP origin is never a production
configuration recommendation.

## Cleanup

The rehearsal removed its own temporary containers, anonymous volumes, network
and generated local configuration. The dedicated Compose test database was
stopped after Java verification. Development PostgreSQL/API and Vite were left
running at their existing local endpoints. Maven's dependency cache was retained
to avoid repeated downloads. No existing company/development volumes were deleted.
