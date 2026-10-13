# Railway trial: isolated local preparation

The company Dockerfiles, Caddy configuration and Compose files are unchanged.
This is a separate single-service React + Spring Boot image, for a disposable
trial with synthetic data only. Do not export, restore, mount, reference or upload
the company database, backups, environment files, attachments or credentials.
This runbook does not authorize cloud actions; the parent/operator owns login,
resource creation, upload, verification, spending and cleanup.

## Review and stage locally

From the project root, run `./scripts/New-RailwayStage.ps1`. It returns a new
`.local/railway-stage-<unique-id>` directory. Review `MANIFEST.txt` there before
any source publication or upload. The manifest lists relative filenames only. The script copies only
reviewed build inputs and rejects unknown file types, private/environment files,
dumps, archives and reparse points, including linked ancestors. Versioned SQL
schema migrations under `backendjava/src/main/resources/db/migration` are the
only permitted SQL files. Other root files are never traversed or copied.

Upload only that exact stage directory, never this project, its parent, `.local`
as a whole, or a previously modified stage. Ignores are defense in depth, not an
upload boundary. Do not place credentials in the stage or Docker build arguments.
If inputs change, create and review a new stage. Stage creation never runs Docker,
Railway CLI, authentication, upload or a server. Old stages are retained for manual
cleanup; the script never deletes existing directories.

## GitHub source path (selected)

The user selected GitHub instead of CLI upload. CLI device authentication was
cancelled. No repository URL is known yet; obtain the intended repository URL
and explicit repository/branch publication authorization before proceeding. This
local preparation neither creates nor publishes a repository, configures a remote,
pushes commits, grants GitHub access, nor connects a repository to Railway.
The repository reply is still pending. Do not create the PostgreSQL service or
public app domain until the intended repository is available.

Use a dedicated private demo repository containing only the reviewed stage's
allowlisted build inputs at its root, plus its filenames-only manifest. Parent/
operator must review the exact proposed commit and scan it for secrets before
publication. Do not initialize/push this shared company workspace or publish its
history. For an existing repository, review both its current files and retained
history for company/private material; a new sanitized commit does not erase old
secrets. Do not assume `.gitignore` removes tracked files or historical content.

After the user supplies and authorizes the repository, parent/operator can connect
that specific repository and reviewed branch/commit to the app service in the
existing empty `EasyPack Demo` project, `demo` environment. Limit integration
access to the intended repository. Keep service root `/` and confirm Railway uses
`railway.json` and `Dockerfile.Railway` from that reviewed commit. Do not connect
another company repository or enable automatic deployment of unreviewed changes.
Record the deployed commit and stage manifest; keep all runtime secrets only in
Railway service variables. Parent owns repository publication and cloud actions.

The safe local stage remains the source boundary for either delivery method.
CLI upload is an alternative only after explicit user selection and authorization;
it is not a fallback while waiting for the GitHub repository URL.

## Operator-only service setup

Use the isolated empty demo project and create a fresh PostgreSQL 17 service to match
the local baseline. Do not silently accept a template's PostgreSQL 18 default;
parent/operator owns the explicit image choice and compatibility verification.
No company connections or imported data. Create one app service from the reviewed stage,
using root `/`, `railway.json` and `Dockerfile.Railway`, one replica, and a 512 MiB
runtime limit. Parent/operator must confirm current trial availability and cost
in the Railway UI. The image builds with Node 22 and Maven/Java 21, embeds Vite
output in the JAR, and runs as numeric user/group 10001 with no root requirement.
Build-time memory is separate from the 512 MiB runtime budget.

Set variables privately in the app service, not in source or this document:

| Variable | Value/source |
| --- | --- |
| `SPRING_PROFILES_ACTIVE` | `railway` (also the image default) |
| `PORT` | Railway-assigned port; Spring binds to `0.0.0.0` |
| `DB_URL` | `jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `DB_USER` | `${{Postgres.PGUSER}}` |
| `DB_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `JWT_SECRET` | Fresh cryptographically random secret of at least 64 bytes, never reused from company/dev |
| `ALLOWED_ORIGINS` | The exact app HTTPS origin, e.g. `https://<app>.up.railway.app`, no slash/path/wildcard/list |
| `SECURE_COOKIES` | `true`; the Railway profile pins secure cookies on |
| `API_DOCS_ENABLED` | `false`; the Railway profile disables both docs and Swagger UI |
| `RAILWAY_SPA_ENABLED` | `true`; set `false` for API-only Railway operation |
| `BOOTSTRAP_EMAIL` | Private owner email, first boot only |
| `BOOTSTRAP_PASSWORD` | Fresh private owner temporary password, first boot only; 12+ characters, at most 72 UTF-8 bytes |

Replace `Postgres` references with the actual fresh database service name. Use
private database networking; a `postgres://` URL is not a JDBC URL. Do not set
`DATABASE_URL` expecting Spring to translate it. Do not enable a public database
proxy for the trial. Do not override `JAVA_TOOL_OPTIONS` or add conflicting JVM
flags without rechecking the memory budget.

The image caps heap at 256 MiB, metaspace at 128 MiB, code cache/direct buffers
at 32 MiB each and stack size at 512 KiB. Tomcat has at most 20 threads and Hikari
at most 3 connections (zero idle minimum). These limits leave native headroom but
are not a total RSS guarantee: parent must measure cold start, Flyway and upload/
report workloads under the actual 512 MiB limit. OOM exits rather than limping on.

Generate the app HTTPS domain and set its exact origin before first public use.
Railway terminates HTTPS; framework forwarded-header handling is enabled only
for this profile. The app port must be reachable only through Railway's trusted
proxy, which must sanitize forwarded headers. Do not expose a direct public port.

## First owner and retirement

Bootstrap is server-side and only runs against an empty users table; there is no
public bootstrap/admin registration endpoint. Arrange first startup/access with
the private owner only. Do not publish an admin account, password, invite or demo
credentials. Log in over HTTPS, perform the mandatory password change, log in
again, then remove both bootstrap variables and redeploy. Confirm the established
owner still works after retirement. Do not seed a shared public administrator.

## Parent verification gate

Updated 2026-10-13: the earlier disk/containerd blocker was resolved for this run.
25 unit/security tests, 79 PostgreSQL integration tests and 11 Edge browser tests
passed. React and the final combined Docker image built successfully. The isolated
512 MiB rehearsal passed HTTPS API, cookie/CSRF, attachment/report workload,
bootstrap retirement and persistence checks; its final peak was 419 MiB.
The combined frontend also passed login/deep-link reload and desktop/tablet checks
over loopback HTTP. Kaspersky blocked the local self-signed browser certificate;
no antivirus settings or machine certificate trust were changed. Public Railway
HTTPS browser verification is still required. See [verification results](RAILWAY_VERIFICATION.md).

Before source publication/deployment, parent runs focused unit tests, staging safety tests, frontend
build, full existing verification and a Docker build as appropriate. Suggested
focused commands: `mvn -f backendjava/pom.xml -Dtest=RailwaySpaSecurityTest test`
and `pwsh -NoProfile -File scripts/tests/Railway-Stage.Tests.ps1`. Those two focused
commands do not require a running server or database. Full integration tests use
the dedicated test PostgreSQL service.

Run `node scripts/tests/Railway-Runtime.mjs` from the repository root to repeat the
isolated runtime rehearsal. It requires installed frontend dependencies, Edge,
Docker and the local `postgres:17-alpine`, `easyback-railway:demo` and
`easyback-web:pilot` images. It creates fresh randomly named test containers and
a network, binds only loopback ports 18443/18780, generates in-memory secrets,
and removes only its own containers/anonymous volumes/network afterward.
It never reads `.env` or accesses the development/company database. The two
allowed origins and HTTP browser endpoint are rehearsal-only; keep the real
deployment configured for its single exact HTTPS origin.

After deploy, verify HTTPS and `/actuator/health/readiness` returns 200 with DB
ready. The readiness group includes the database. Only health is exposed by the
Railway actuator configuration; never expose environment/configuration endpoints.
The healthcheck is a deployment readiness gate, not ongoing monitoring.

Verify `/`, `/index.html`, `/brand-mark.svg`, generated `/assets/...` and every
actual React route including UUID detail routes support GET/HEAD. Deep links
return the index resource directly, without forwarding or a catchall. Missing
assets return 404, not HTML. Unknown routes, malformed UUIDs, `.env`, source maps,
unknown APIs and actuator/docs paths must never return the SPA. Non-GET/HEAD SPA
requests must not be public. API auth, CSRF, permissions and forced password
change remain enforced. Confirm missing-CSRF login/refresh/logout fail and secure
SameSite cookies, frame denial, nosniff, HSTS over HTTPS, same-origin referrer policy
and disabled camera/microphone/geolocation headers are present on public pages.

Confirm profile absent and `RAILWAY_SPA_ENABLED=false` both leave the default API
deny-all boundary intact. Check untrusted origins cannot make credentialed API
calls and disabled docs remain unavailable. Browser-check login/password change,
deep-link refresh and synthetic CRUD at the actual HTTPS origin. No company data.

Record deployed stage, variable names only (no values), readiness result, memory
observations and cleanup owner. Remove disposable trial resources when done and
rotate any trial secrets inadvertently disclosed. This is not production approval.

Railway references: [config-as-code](https://docs.railway.com/config-as-code/reference),
[healthchecks](https://docs.railway.com/deployments/healthchecks),
[restart policy](https://docs.railway.com/deployments/restart-policy).
