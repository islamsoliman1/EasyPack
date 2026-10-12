# Company Server Runbook

## Boundary

The root Compose file is localhost development only. Use `deploy/compose.yaml` for the prepared company configuration. Production has not been deployed. No changes to `easyback.com` have been made. The example `factory.easyback.com` is a proposed private hostname, not a registered service.

Use LAN access in the factory and a managed VPN with MFA for owner/manager remote access. Do not port-forward the API, PostgreSQL, Vite or this gateway to the public Internet. The prepared gateway uses Caddy's internal CA: install its root certificate on managed clients through a trusted administrative channel. Preserve its private CA key securely. A public CA alternative needs a separate approved certificate/DNS setup.

## Prepare

1. Choose the private interface IP and internal DNS record. Configure the firewall for trusted LAN/VPN clients only. Verify VPN MFA and account revocation from an outside connection.
2. Provision Docker/Compose on the selected server; enable time synchronization and automatic service restart. Check power/UPS and recovery behavior.
3. Create `deploy/.env` from the field names in `deploy/.env.example` using unique secrets. Never reuse development secrets. JWT requires at least 64 random characters; application/admin DB secrets must be separate. Restrict access to the environment file and use disk encryption.
4. Run from the project root:

```powershell
./scripts/Test-ProductionConfig.ps1 -EnvironmentFile ./deploy/.env -InitialProvisioning
docker compose --env-file ./deploy/.env -f ./deploy/compose.yaml build
docker compose --env-file ./deploy/.env -f ./deploy/compose.yaml up -d
docker compose --env-file ./deploy/.env -f ./deploy/compose.yaml ps
```

PostgreSQL initialization creates `easyback` as a non-superuser schema/database owner for Flyway and the application. `easyback_admin` is reserved for database administration. Initialization runs only for a new data volume: changing environment values does not rotate existing DB passwords. Never delete a data volume to change a password.

5. Check API health from inside its container, application HTTPS from a trusted workstation, and secure cookies through the gateway:

```powershell
docker compose --env-file ./deploy/.env -f ./deploy/compose.yaml exec -T api wget -q -O - http://localhost:8080/actuator/health
```

6. Change the bootstrap password on first login; remove both `BOOTSTRAP_EMAIL` and `BOOTSTRAP_PASSWORD` from the environment file afterward and recreate the API container with the same explicit env file. Established databases start without bootstrap values and existing accounts are not changed. Run `Test-ProductionConfig.ps1 -EnvironmentFile ./deploy/.env` without `-InitialProvisioning` for subsequent deployments. An empty database without valid bootstrap values fails closed; use `-InitialProvisioning` before a first deployment to validate them. Assign least-privilege roles to named users. Confirm breaks before real work begins, then enter approved checklist templates.

## Back Up And Verify

The scripts default to root development Compose. Always pass both the production Compose path and explicit environment file for company data; production Compose without `-EnvironmentFile` is rejected. Absolute paths work from any working directory; supplied relative paths resolve against the caller's directory. All Compose commands, including cleanup, reuse the resolved paths. They use Docker file copy, not a PowerShell binary pipeline.

```powershell
$backup = ./scripts/Backup-Database.ps1 -ComposeFile ./deploy/compose.yaml -EnvironmentFile ./deploy/.env -OutputDirectory 'D:/EncryptedBackups/EasyPack'
./scripts/Verify-Restore.ps1 -ComposeFile ./deploy/compose.yaml -EnvironmentFile ./deploy/.env -BackupFile $backup -DatabaseAdmin easyback_admin
```

The dump includes all DB records and attachment bytes. It is plaintext-at-rest unless the destination volume/container is encrypted. Restrict ACLs, encrypt before off-host transport, and keep a protected off-host copy. Independently back up `.env`, Compose/configuration and Caddy's `/data` volume, which contains private CA material; store these separately from broadly accessible dumps. Retention and scheduled backup times require manager approval; the scripts do not silently create scheduled jobs or delete old backups.

Verification uses an isolated temporary database on the selected PostgreSQL service. Schedule it outside busy periods and allow free space for an additional restored copy. It checks dump checksum, SQL restore success and every stored attachment's size/SHA-256. It does not prove client certificate trust, VPN routing, hardware recovery or complete business acceptance.

For an actual disaster recovery: rehearse on a separate server with a new volume, initialize the same non-superuser `easyback` role/database owner, then restore using the administrator connection with `pg_restore --role=easyback --no-owner --exit-on-error`. Restore restricted configuration/CA state, and verify schema, users, assignments, serial stock, attachments, work sessions and trials before switching DNS. Do not restore over a running live database. Take a pre-upgrade backup and verified restore before deploying future migrations; reversing an image alone does not reverse a schema migration.

## Acceptance Checklist

- Valid trusted HTTPS on desktop/tablet; DB/API ports inaccessible from clients and WAN.
- Unauthenticated requests denied; worker access limited to own tasks/files; roles and revocation tested with named accounts.
- Remote owner/manager login through VPN MFA, with offboarding and recovery documented.
- Work schedule and breaks approved, Friday exceptions and 20:00 extension verified without retroactive time.
- Company-approved trial criteria, failure/retest and separate handover verified on real machines.
- Encrypted off-host backups, restore rehearsal, retention and monitoring ownership agreed.
- Health/startup failures, disk space and failed backups monitored by the company's operations tooling; no monitoring service is installed by this repository.

Start with the small approved pilot. Hardware sizing and concurrent-load acceptance must be measured on the actual server before expanding to all 100 accounts. Kubernetes is not part of this deployment.
