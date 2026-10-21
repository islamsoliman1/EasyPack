# Main application localization

Implemented in the real-authentication main application. Existing notification and review changes remain in place; the demo dashboard, visitor login, sample-data seeders, and demo profile were not imported.

## Language behavior

- Arabic is the default. English/العربية is persisted in browser storage and applied to document language/direction before startup, then kept in sync by i18next.
- Language controls are available at login, forced password change, startup loading/error states, the authenticated header, and dialogs. Switching language retains form state.
- Login, password changes, account/permissions, users/roles, catalog, BOMs, orders, stock, preparation, raw material/cutting, assembly, defects, operation trials/templates, shifts, files, reports, and notifications use reviewed UI translations. Dates and display numbers follow the selected locale; identifiers, technical form values, and CSV numeric/date columns retain their machine-readable contracts.
- React Query keys include language, with prefix invalidation preserved. A language-only refetch retains the same record's normalized original data, avoiding dialog remounts. Notification inbox pagination uses the provider's locale key too.
- Order machine/BOM/responsible selectors, the machine model selector, and asynchronously loaded user role checkboxes are controlled from form state so options loaded after mount retain saved selections.

## API and authored content

- Requests send `Accept-Language`, including authentication and binary exports. Retries retain the request's original language. Real session refresh/401 handling and permission-scoped caches are unchanged.
- The request filter selects weighted Arabic/English headers, defaults unsupported headers to Arabic, sets `Content-Language` and `Vary: Accept-Language`, and clears request-local state.
- Error messages and CSV headers/status/boolean labels are localized without changing error codes or CSV protection against formulas.
- Reviewed content dictionaries cover approved terms, notification/reminder titles, generated order notifications, system notes, and the main Bootstrap role/account labels. JSON content projection includes `originalText` and `translationMissing`; code/status/identifier fields are preserved.
- The client normalizes API records back to original values before caching and editing, removing presentation metadata. Display translation is applied at render time. English dialogs explain this rule and editable text forms show a reviewed preview where applicable.
- Arbitrary authored text without a reviewed translation remains in its original language. This is deliberate and explicitly described in the English workspace, dialogs, and previews; there is no automatic translation service, database backfill, schema migration, or persistent text rewrite.

## Validation

- The final `npm run build` passed. The packaged main image was built and verified separately from the demo.
- `npm run audit:translations` checks 931 UI translations and 56 reviewed content translations, source/dictionary coverage (including validation and status maps), interpolation parity, frontend/backend content parity, Arabic/English API error parity, localized query imports, and absence of visitor authentication fallback.
- Added backend localization unit and MVC coverage for weighted language selection, concurrent requests/thread cleanup, response headers, DTO/list serialization, nested historical snapshots, source preservation, arbitrary-text fallback, numeric precision, and bundle parity.
- Final backend verification passed 30 unit/security/localization tests and 91 integration tests. Existing browser regressions passed seven authorization-cache tests and one notification workflow test. Guarded isolated API acceptance passed 241 assertions.
- Targeted main browser acceptance covered real login and forced-password changes, existing validation relocalization, users/roles and all 51 permission controls, order machine/BOM/supervisor hydration, retained unsaved edits, operation template source values, real notification targets, independent/persisted locales, RTL/LTR, mobile layouts and dark mode. Full authenticated fixture workflows used a separate rehearsal database on port 18082; no test users or manufacturing fixtures were added to the existing main database.
- The reviewed image is now running as the main local API. All 41 public-table row counts and full-row hashes match the original main backup baseline after the update. All 13 migration files are byte-identical to the pre-change source snapshot; the existing schema remains V13 with no new migration. The rehearsal also preserved every table hash across app restart, together with browser session, language preference and notifications.
- The actual main Vite login and proxy were checked in both languages. The API is healthy, permits credentialed CORS for the explicit local frontend origin, rejects an untrusted origin and retains localized 401 responses with stable error codes. Final review and detailed evidence are in `LOCALIZATION_REVIEW.md`.

## Current local runtime

Main frontend: **http://localhost:5205**. Main API: **http://localhost:18080**. This is a local update; no remote deployment was performed.

The current Windows host reserves TCP ports 5105–5204, including the normal frontend port 5173. An ignored local compose override at `.local/localization-runtime.compose.yaml` reuses image `easyback-localized:review` (`sha256:f81cc1c60f54ca670d5c47f18445b26f0b24941fc9a13349427093f35475424b`) with the `default` profile and the original database/authentication/cookie/API-doc settings. It clears the combined image's `JAVA_TOOL_OPTIONS` to retain the development API's prior JVM configuration and adds `http://localhost:5205` while preserving the existing allowed origins. The packaged-frontend rehearsal used the `railway` profile on isolated port 18082.

To restart this reviewed local setup from the main project directory:

```powershell
docker compose -f compose.yaml -f .local/localization-runtime.compose.yaml up -d --no-build api
./scripts/Start-Frontend.ps1 -Port 5205
```

The override and image tag are local verification artifacts, not deployment configuration. A normal source build includes the localization implementation. The frontend launcher chooses the first available port in its ten-port range; keep the chosen URL explicitly allowed by the local API. The currently running frontend uses 5205.

The source/database safety snapshots remain in ignored `backups/` and `.local/`. Long English account names wrap narrowly in the mobile header at 390px; Sol classified this as cosmetic, with controls and navigation still usable and no page overflow.

## Maintaining translations

Add UI wording to `frontend/src/translations.json` (notification UI also has its own dictionary). Reviewed Arabic-to-English content lives in `reviewed-content.json` and `notification-content.json`; English-origin system wording lives in `system-content.json`. Keep each content dictionary synchronized with its backend resource and run the translation audit after changes. Preserve original form values and avoid translating protocol keys or stored account/permission identifiers.
