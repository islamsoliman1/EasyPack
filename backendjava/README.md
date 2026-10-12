# EasyBack Backend

Java 21 / Spring Boot API. This is the active backend; the old .NET `../src/` outside the Java project is untouched.
Run it from the Java project root (`Easypackjava/`) with `docker compose up -d --build postgres api`.

The initial slice is identity and access administration. Source is organized under
`com.easyback.identity`; migration `V1__identity.sql` owns its PostgreSQL schema.
Administration writes are transactional, serialized with `security_guard`, and audited.
Refresh token replay revokes its session even though the request returns 401.

Run unit and real-PostgreSQL integration tests with
`docker compose --profile test run --build --rm verify` from the Java project root (`Easypackjava/`).
Do not run `IdentityIT` against a database containing real data: it resets identity tables.
It refuses to start without an explicit `DB_URL` ending in `/easyback_test`, and checks
the connected database name again before resetting tables.
Docker provides Maven and Java, so installing Maven on Windows is not required.
The verification container mounts the current source and POM read-only and runs a clean
build; compiled files stay inside the disposable container, not in the source tree.

See the root README for configuration, credentials, API URLs, frontend and deployment limits.
