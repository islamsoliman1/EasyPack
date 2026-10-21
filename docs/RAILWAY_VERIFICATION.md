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

The rehearsal's extra loopback HTTP origin is never a production configuration
recommendation. Public HTTPS verification is recorded separately below.

## Public Railway Verification

Verified 2026-10-14 at https://easypack-demo.up.railway.app using the existing
deployment. These checks did not change cloud configuration or application data.

- Railway reported a successful deployment with the public domain targeting port
  8080 and no staged changes.
- The root page, built JavaScript, and direct `/shifts` and `/roles` page requests
  returned HTTP 200 over HTTPS.
- `/actuator/health/readiness` returned HTTP 200 with status `UP`.
- `/api/v1/auth/csrf` returned HTTP 200 and issued a Secure CSRF cookie.
- HTTPS responses included Strict-Transport-Security.
- Edge accepted the public certificate and rendered the Arabic login screen.
  Its screenshot was visually inspected and saved as an ignored local artifact
  at `output/playwright/railway-public-login.png`.
- The browser's only reported console error was HTTP 401 from
  `/api/v1/auth/refresh`, expected for a browser without a login session.

Authenticated public login, forced password change, session restoration and
business workflows remain unverified on Railway. No administrator credentials
were read or submitted during these checks; the authenticated local rehearsal
above does not replace verification against the public deployment.

## Cleanup

The rehearsal removed its own temporary containers, anonymous volumes, network
and generated local configuration. The dedicated Compose test database was
stopped after Java verification. Development PostgreSQL/API and Vite were left
running at their existing local endpoints. Maven's dependency cache was retained
to avoid repeated downloads. No existing company/development volumes were deleted.
