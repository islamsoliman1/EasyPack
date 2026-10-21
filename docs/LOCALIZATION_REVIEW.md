# Main Arabic/English implementation review

Reviewed and approved on 18 October 2026 by Sol 6.1. Implementation by Astra; runtime verification by the parent agent.

## Decision

**Approved for the scoped main bilingual release and completed local update.** The reviewed main application image is `sha256:f81cc1c60f54ca670d5c47f18445b26f0b24941fc9a13349427093f35475424b`. Main regression, isolated real-authentication acceptance, targeted browser checks, existing-main startup and exact data/migration preservation passed. No unresolved release blocker was identified within this scope.

This decision applies to `E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava`. It uses main-specific evidence; the earlier standalone-demo approval does not substitute for main acceptance. No remote deployment was performed. This is not exhaustive end-to-end certification of every workflow.

## Scope and compatibility

The implementation covers Arabic/English interface, system/error/report/notification strings, browser-persisted language, RTL/LTR direction and locale-aware display formatting. Request-local backend projection adds original-source metadata; the frontend restores original values before caching, editing or submitting. Reviewed immutable translations apply at display boundaries. Identifiers, enums, permissions, quantities, historical source snapshots, attachment filenames and machine-readable date/numeric contracts remain intact. CSV retains escaping/formula protection, precision and UTC semantics.

Main retains real login, refresh, logout, forced password changes, full administration, authorization and file workflows. Demo visitor authentication, visitor restrictions, dashboard replacement, sample notification seeding and demo migration history were not imported. All 13 main migration files remain byte-identical to the safety snapshot; schema history remains at V13. Localization required no migration, data rewrite, backfill or reset. Preexisting notification/review work was preserved.

Arbitrary authored text, personal names and uploaded contents are not automatically translated. Unknown text retains its original language with explicit fallback explanations in the English workspace/forms and API metadata. Paired-language storage/authoring remains a future proposal.

`AuthorizedWorkspace` retains a user/permission authorization key and a fresh QueryClient per authorization scope, with cleanup. Language is excluded from that scope key, preserving open forms during toggles while permission changes discard old private data. Real notification bodies, user/permission isolation, read state and target navigation remain intact.

## Findings corrected during review

- Reachable user-name length validation emitted a default English Zod error in Arabic. Explicit reviewed messages and the native 120-character limit now preserve the contract; visible errors translate at render time. Role length messages are explicit too.
- Weekday summaries and composite assembly/defect action titles translated only after joining dynamic text. Each human-facing fragment now translates before interpolation/joining.
- English previews use a readable `Display name` label. Original-data normalization strips localization metadata before editing/submitting.
- Inherited asynchronous-select hydration was corrected in order/machine forms and asynchronously loaded user-role checkboxes. Displayed choices now follow original form IDs while retaining registered handlers; changing machine clears its dependent BOM.
- An English workspace note explains original-text fallback to list-only users.

Relevant React best-practices review covered hooks, form identity, controlled inputs, subscriptions, accessibility, event/timer cleanup and cache isolation. No unrelated framework/performance refactor was required. At 390px, the long English account name wraps into several short header lines; this is a nonblocking cosmetic limitation. Controls remain accessible without overlap or document overflow.

## Completed verification

- Frontend production build and recursive audit passed for 931 UI keys and 56 reviewed content entries, including API bundle parity.
- `.local/main-localization-final-regression.log`: 30 unit/security/localization tests and 91 `IdentityIT` integration tests, zero failures/errors/skips; `BUILD SUCCESS` at 2026-10-18T11:18:26Z. Typed-list/nested JSON serialization and exact numeric tokens are covered.
- `.local/main-localization-cache-tests.log`: seven authorization-cache browser tests passed on isolated port 18082. These mocked all API routes and used no live credentials or server fixture writes; coverage includes permission downgrades, late responses, open private detail removal and parent-order version refresh.
- `.local/main-localization-api-acceptance.log`: 241 guarded main localization/auth/API assertions passed on isolated port 18082, including full 51-permission collections, forced-password enforcement/revocation, original-source saves, real workflow notifications, CSV and concurrent locale requests.
- `.local/main-localization-notification-tests.log`: the existing real notification regression passed, covering persistence, foreground polling, failed-read retry and exact task/preparation targets. Synthetic credentials were explicitly injected, bypassing root `.env` reads. Exact Arabic count expectations were adapted with `Intl.NumberFormat('ar-EG')`; behavioral assertions were retained.
- Targeted isolated browser checks exercised successful login, forced password changes, administration and source-safe forms (`output/Browser-Main-Auth.js`, `output/Browser-Main-Admin.js`), plus workflow/deep-link/locale behavior (`.local/main-localization-browser-workflow.log`). The same reviewed main image was used with real authentication on isolated port 18082.
- `.local/main-localization-browser-restart.log`: isolated restart preserved all public-table hashes, the browser session, English preference and two real notifications.
- Screenshots under `output/playwright/` cover login, forms, notifications, themes and mobile layouts. Sol independently inspected `main-mobile-dark-english.png`, `main-mobile-dark-arabic.png` and `main-order-form-english.png`; no layout blocker was found.

The first main integration run had one stale display-name assertion: it searched default Arabic responses for the English display `Administrator`. The test-only correction now locates `originalText.name`, asserts displayed Arabic and original English before/after update, and verifies the database still stores `Administrator`. Full permission/override roundtrips and unknown-permission rejection remain intact. The completed rerun above supersedes that failed run.

Early API harness attempts had setup-only revoked-token and stale-version errors. The helper cleared its revoked token before relogin and refreshed the parent stock version; application source did not change. Only the completed 241-assertion result is counted as acceptance.

## Existing-main update and preservation

Before updating main, the runtime owner saved a source ZIP/preexisting patch, a 777006-byte custom PostgreSQL backup and all-public-table baselines. Main contained 81 orders, 83 machines, 173 tasks and 130 users.

The existing `easyback-api-1` now runs the approved image under the default profile through an ignored local compose override, retaining its database, JWT, cookie, API-doc and CORS settings. The combined image's `JAVA_TOOL_OPTIONS` is cleared for the prior local JVM configuration. The packaged railway rehearsal remains isolated on port 18082. A redundant backend-only build was cancelled after storage pressure; unused cache was reclaimed without removing databases or the accepted image.

Windows Hyper-V reserves ports 5105–5204, preventing the planned Vite 5173 listener. The actual main frontend is `http://localhost:5205`; its localhost origin was added to the existing CORS list through the ignored runtime override. Application source/image did not change for this environment adjustment.

- `.local/main-localization-local-runtime.log`: main health, Vite source/proxy, Arabic/English unauthenticated responses, credentialed CORS for port 5205 and rejection of an untrusted origin passed.
- `.local/main-localization-browser-live.log`: the actual main login screen passed Arabic/English switching, LTR/RTL, preference persistence and no page errors. No live credentials or fixture writes were used.
- Sol independently compared `.local/main-localization-before.txt` with `.local/main-localization-after.txt`: all 41 public-table row counts/full-row hashes are exactly identical, including audit/session data. All 13 applied migrations are unchanged; no new migration was applied.

Successful authentication/admin/workflow testing occurred against the same main image in the isolated real-authentication rehearsal. Live-main checks deliberately avoided credential mutation and authenticated writes to preserve existing data. Remote-host HTTPS/networking remains a deployment-environment check.
