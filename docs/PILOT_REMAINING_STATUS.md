# Remaining Pilot Delivery

Updated 2026-10-17. This supersedes older references to shifts, files, templates, reports and in-app notifications as future work.

## Implemented

- Cairo work calendar: Saturday through Thursday, 08:00-17:00; reasoned Friday exceptions and day-specific extension to 20:00.
- Separate permissions for viewing schedules, managing workdays/breaks, approving extensions and stopping another worker's timer.
- One running work session per worker/task; pause/resume with reasons and immutable session history. Installation, rejection and return stop time.
- Sessions are capped at their own day's boundary. A late extension closes expired sessions first: the gap is never retroactively credited. A new day requires explicit resume.
- Starting a physical task outside the approved shift records a zero-duration `OUTSIDE_SHIFT` entry, not unapproved overtime. Resume outside the shift is rejected.
- Weekly breaks require explicit manager approval, including explicit approval of no deduction. Until then net time is unknown, not zero or an invented break.
- Daily calendar snapshots preserve historical calculations. Weekly changes apply only to days not already materialized; used days cannot be shortened or rewritten. Only zero-duration outside-shift attempts do not prevent opening Friday.
- Scoped PDF/PNG/JPEG attachments for orders, physical machines, catalog parts and defect cases. Upload/delete require `files.manage` plus target access. Workers inherit access only through their assigned tasks (or their own defect reports).
- Up to 10 MiB/file and 10 million pixels/image, byte-level format checks, duplicate-content protection, safe download headers, versioned soft deletion and audit. Images preview inside the authenticated UI; PDF is downloaded.
- Attachments live transactionally in PostgreSQL for the small pilot, including deleted audit content. There are no public file URLs. This is not a CAD/3D viewer or malware scanner; approve file sources and retention before production.
- Reusable, versioned and archivable Operations checklists. Starting a trial copies selected criteria, so later template changes cannot rewrite a trial. No technical acceptance values were invented or pre-approved.
- Manager report by delivery-date range: assembly progress, shortages, defects, expected/recorded time, completion and actual delivery. Assembly, completion and delivery lateness are distinct fields; cancelled orders do not inflate outstanding shortages.
- UTF-8 CSV with spreadsheet-formula protection and browser print/PDF layout for the complete filtered rows. This is not native XLSX or a server-generated PDF export.
- Fifteen-second report/detail refresh, plus a persistent personal notification inbox and header bell with 30-second foreground polling. Workflow events and recipient rows commit with the business action. Current permissions and task-assignment occurrence are rechecked for every inbox operation; owner summaries have an authorized order fallback.
- Task assignment, order release/shortage, preparation request/reopen/fulfillment, defect report/quarantine/repair completion, testing readiness, failed/aborted/invalidated trials and order completion notifications. Capability-based routing suppresses the actor and logs events with no eligible recipient; no role grants are added.
- UTC-clock delivery reminders run every 15 minutes, once within 24 hours and once overdue; completed-undelivered orders remain eligible. Draft/cancelled/delivered orders are excluded. The UI displays Cairo times. There is no WebSocket, email, push, SMS or closed-browser delivery.

## Time Boundaries

Time is operational task time, not payroll/attendance. V12 preserves a conservative incomplete-history marker from available task, event and installation evidence, including work predating V10. Resume, return, reassignment and rework retain the warning; net totals remain unknown for incomplete history. Gross figures include recorded sessions only; missing durations are never reconstructed from installation timestamps. Expected minutes remain frozen from the order requirements. Closed sessions are retained when a worker changes or a task is reworked.

## Deployment Preparation

`deploy/compose.yaml` provides PostgreSQL, Java API and a built React/Caddy gateway. Only private-interface HTTPS is published. The API uses secure cookies, exact same-origin access, disabled API docs and a non-superuser database owner; the DB administrator has a separate secret. No Kubernetes is required for this pilot.

`scripts/Backup-Database.ps1` produces a custom-format PostgreSQL dump and SHA-256 manifest, including attachment bytes. `scripts/Verify-Restore.ps1` checks the manifest, restores into a fresh randomly named verification database and checks attachment lengths/hashes before dropping only that database. It never replaces the live database. Dumps are **not encrypted by these scripts**: use a restricted encrypted backup destination and an encrypted off-host copy. Secrets, gateway CA keys and configuration require separate secure backup.

See [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md). Preparation is not deployment to the company server: no DNS, public routing, VPN, certificate trust or remote MFA was changed.

Configuration finder, relative to `Easypackjava/`: root `compose.yaml` and `.env` are development-only; company deployment uses `deploy/compose.yaml` with a restricted explicit environment file, normally `deploy/.env`, whose field names are in `deploy/.env.example`. Use `scripts/Test-ProductionConfig.ps1 -EnvironmentFile <path> -InitialProvisioning` before first boot; omit `-InitialProvisioning` after bootstrap retirement. Production backup/restore requires both `-ComposeFile` and `-EnvironmentFile`; use `-DatabaseAdmin easyback_admin` for production restore verification. Exact commands and operational boundaries are in the runbook. Do not place real secret values in status documents.

## Bounded Follow-Up

Astra completed read-only planning; Sol6.1 implemented only the five reviewed findings:

- Explicit production environment selection is resolved once and reused by backup/restore Compose commands, including failure cleanup; development defaults remain supported.
- Bootstrap values are optional for established databases; explicit initial-provisioning validation and empty-database fail-closed behavior support credential retirement without changing existing accounts.
- Friday cannot be selected as a recurring weekly workday. Dated, reasoned approval remains available; separate extension permissions and historical snapshots are unchanged.
- Report JSON and CSV share search/status/late/missing predicates; screen and print use the same filtered rows, preserving export authorization and CSV escaping. Other table consumers retain their existing search behavior.
- Additive V12 preserves conservative legacy-time provenance across resume, return, reassignment and rework. Incomplete history keeps net time unknown without inventing durations.

## Verification

Final automated, deployment-rehearsal and manual report results below were confirmed by the parent verification run. The 107 automated tests exclude Playwright CLI/manual checks and the separate PowerShell deployment checks.

- 17 unit tests, 79 real-PostgreSQL integration tests and 11 existing Edge browser tests passed: 107 automated tests total. Java BUILD SUCCESS in 3:04; V12 migration passed. Deployment PowerShell mock checks passed separately, including explicit environment selection and cleanup from a different working directory.
- React production build and final Java API image build passed. The development API was rebuilt/restarted with V12; V12 also passed on the dedicated test database. Final `Invoke-RestMethod http://localhost:18080/actuator/health` check confirmed UP. `docker compose --profile test stop test-postgres` completed with exit 0 and the service Stopped; no execution sessions remain.
- Final production web Docker image built successfully from the latest frontend; Caddy configuration was also validated. Company network acceptance remains outstanding.
- Manual Playwright CLI verification against the real API/data passed: all 54 orders across six screen pages matched the complete print row codes; `COMPLETED` returned the same five codes in UI, print and downloaded CSV; case-insensitive trimmed code search returned one matching row across all three; no-match search returned zero rows and a header-only CSV. CSV was parsed with PowerShell `Import-Csv`, not an ad hoc parser.
- Tablet screenshot at 834x1112 was inspected and readable: `output/playwright/report-filter-final-tablet.png`. These CLI/manual checks are separate from the 107 automated tests and PowerShell deployment mock checks.
- Prior CLI browser checks covered schedule/report layouts, explicit break confirmation, CSV download, print and archived template creation; these remain historical manual checks, separate from the automated-test count.
- Attachment upload, authenticated preview/download and soft deletion verified through the UI; downloaded bytes matched the original SHA-256.
- Revised development backup and isolated restore passed from a different working directory with an explicit environment file: schema V12, 48 orders and one attachment restored; attachment integrity checks passed. The live database was not replaced.
- Fresh isolated production Compose/PostgreSQL rehearsal with the non-superuser application role and final API image passed: an empty database without bootstrap credentials fails closed; valid first boot creates one administrator; restart without bootstrap credentials is healthy and preserves identity, password hash and version.
- Production-configuration backup and isolated restore passed with explicit `--env-file` selection and `DatabaseAdmin easyback_admin`: schema V12, zero orders and zero attachments. Temporary Docker resources and the generated secret environment file were removed. This is not deployment to the company network or validation of its real secrets, DNS, VPN or certificate trust.
- Non-blocking Vite main bundle warning remains around 531 kB.

Prior baseline, retained for history: 14 unit tests + 71 PostgreSQL integration tests + 11 Edge tests = 96 automated tests; V10/V11 and the earlier V11 development backup/restore rehearsal had passed. The final counts and V12 rehearsals above supersede that baseline.

## Company Acceptance Still Required

1. Approve break intervals before the first real workday is materialized; no break deduction has been approved on your behalf.
2. Enter company-approved Operations checklists and acceptance values.
3. Assign the new permissions to actual departments and pilot users; only existing full-administration roles were migrated automatically.
4. Supply server OS, private IP, internal hostname/DNS, VPN/MFA and certificate management decisions. Verify firewall, time synchronization, restart/power recovery, monitoring and encrypted off-host retention.
5. Run the small pilot with real workers and confirm timing, drawings, workflow and report accuracy before wider rollout.

Deferred: post-completion corrective orders, downtime policy, free-form cutting optimization, 3D and full chat. None was silently added to this delivery.
