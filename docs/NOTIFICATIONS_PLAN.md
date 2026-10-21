# Notifications: project review and implementation plan

Reviewed: 2026-10-14. Implemented: 2026-10-17. The sections below preserve the design
and acceptance contract; implementation notes and verification status follow here.

## Implementation status (2026-10-17)

Implemented persistent personal inboxes, V13, scoped count/list/read/read-all APIs,
capability-based workflow recipients, frozen safe Arabic summaries, a header bell,
lazy inbox, foreground 30-second refresh, exact task/preparation URLs, and the
complete event matrix including repair/preparation completion and delivery reminders.
`DEFECT_RECEIVED` also informs repair managers when the quarantined piece can be
started. No role grants, external delivery channels, Kafka or deployment were added.

Task assignment has its own occurrence counter: old assignments stay hidden after
A → B → A, while unchanged assignments emit nothing and preserve task work state.
One SQL visibility view applies current effective permissions before pagination and
to counts/read operations. Dual receiver/repair capabilities remain alternatives;
an original owner can fall back to the authorized order summary after losing
department access. Saved recipient text contains only fixed event wording and the
order code, never report reasons, trial notes or later mutable titles.

The writer requires an existing transaction; an insert error rolls the originating
business change back. UTC Clock drives notification/read times and reminder scans.
The scheduler runs every 15 minutes, rechecks each candidate in a separate guarded
transaction, includes completed-undelivered orders, and emits only the applicable
24-hour or overdue stage. Configure `easyback.notifications.scheduler-enabled=false`
to disable it, or `easyback.notifications.scan-ms` to change the interval (milliseconds).
Tests disable automatic scheduling and call the evaluator with a controlled clock.

New integration coverage is in `IdentityIT`; real-browser coverage is in
`frontend/tests/notifications.spec.ts`. Earlier design-only statements below
describe the original planning review, not the current implementation.

## Verification (2026-10-17)

Astra implemented the feature; Sol 6.1 reviewed the backend, frontend, migration,
workflow hooks, and tests. The reviewer reported no unresolved actionable findings
after the permission-alternative and owner-fallback correction.

- 25 unit tests passed.
- All 79 existing PostgreSQL integration tests passed in the regression run.
- All nine final notification integration tests passed in a focused run, including
  independent recipient reads, filtering before pagination, assignment supersession,
  forced notification-insert failure rolling back the assignment, permission
  alternatives/fallback, repair/preparation handoffs, repeated trial cycles, and
  reminder boundaries/concurrent deduplication. These are 88 distinct integration
  tests verified across the regression and focused runs.
- All 12 Edge browser tests passed, including task/preparation alert navigation,
  read persistence/retry, foreground/hidden/offline behavior, account isolation,
  and the existing application workflows. Total distinct automated tests: 125.
- The production frontend and local Java API image built successfully; V13 applied
  to both the isolated test database and local development database.
- Restarted the local API and confirmed health UP. The saved event count, recipient
  count, read count, and recipient/read-state checksum were unchanged afterward.
- Visually inspected the Arabic RTL tablet notification screenshot at
  `frontend/test-results/notifications-personal-not-e9a93--exact-task-and-preparation/notifications-tablet.png`.
- `git diff --check` passed; the existing non-blocking Vite main-chunk warning remains.

Early runs caught an array-type mismatch in the migration and two new test-fixture
assumptions (bearer CSRF behavior and timestamp binding). Those were corrected and
the affected cases passed in the final focused run. Shared authentication was not
changed. Local verification logs are under `.local/notifications-*.log` (ignored).

## 1. Scope and recommendation

Build in the active Java/React project at
`E:/FreelanceProjects/EasyPack/EasyBackBackEnd/Easypackjava`.
The chat's current directory, `E:/FreelanceProjects/Easypackjava`, was empty
when inspected. The sibling .NET/Angular application and React design mockups
are separate implementations; their notification hubs are not reusable Java infrastructure.

Start with a PostgreSQL-backed personal inbox, a bell in the authenticated
header, and a 30-second foreground refresh through the existing API client.
This supports offline recipients when they next sign in. Expected visibility
is the next successful refresh while online; closed browsers receive no push.

The source review covered business services/controllers, authentication and
permission handling, Flyway migrations V1–V12, React routing/query state,
integration/browser test patterns, and existing scope documents. It was a
static implementation-readiness review, not a runtime or deployment test.

## 2. Review findings that change the earlier plan

| Priority | Evidence in current source | Implementation consequence |
| --- | --- | --- |
| Required | `OrderService.release()` reserves available pieces and creates tasks. `StockService.requestPreparation()` explicitly creates requests; `syncPreparation()` only updates existing ones. | Treat shortage after release and preparation requested/reopened as separate events. An unfulfilled reservation does not itself create a preparation request. |
| Required | `DefectController` requires `defects.view + orders.view` for global defect details. `StockController` requires `orders.view` plus warehouse/preparation access. | A recipient's job title, responsibility for an order, or one manage permission does not grant all detail access. Select a permitted target and limit the notification content accordingly. |
| Required | `AssemblyService.syncOrder()` runs on many actions and increments order version even if status is unchanged. `OperationsService.resolve()` independently sets `AWAITING_TESTING`. | Emit ready-for-testing only on a real status transition, covering both paths. Allow another alert for a later testing cycle. |
| Required | `OperationsService.finish()`, `abort()`, and `configurationChanged()` can all lead to `REWORK`. | Cover failed, aborted, and invalidated trials with distinct wording. Do not label every rework event “test failed.” |
| Required | `OperationsService.deliver()` sets `delivered_at` while order status remains `COMPLETED`. | Delivery reminders must include completed-but-undelivered orders. Exclude drafts, cancellations, and actual deliveries. |
| Required | `Assembly.tsx` reads `?order=` but holds the selected task in local state. `Warehouse.tsx` has no preparation URL selection. `Defects.tsx` already supports `?case=`. | Add task/preparation URL selection; reuse the existing defect URL. Do not invent nonexistent detail routes. |
| Required | `IdentityStore.permissions()` applies role grants and explicit overrides. Authentication rechecks permissions and active sessions per request. | Apply current access to inbox rows, counts, and read actions too; saved notifications must not bypass later revocation or reassignment. |
| Needed | The Java/React implementation has no notification schema/API, scheduler, outbox, or WebSocket configuration. Existing event tables are workflow histories. | Add a focused notification module. Existing histories supply hook points but are not a delivery queue. |
| Reusable | Spring JDBC transactions, PostgreSQL/Flyway, a UTC `Clock` bean, TanStack Query, `api.ts`, and Playwright/integration tests already exist. | No new infrastructure dependency is necessary for the proposed first release. |

Source locations, relative to this project:
- [Order release](../backendjava/src/main/java/com/easyback/orders/OrderService.java): `release()`, line 131.
- [Preparation lifecycle](../backendjava/src/main/java/com/easyback/warehouse/StockService.java): `syncPreparation()`, line 100; `requestPreparation()`, line 180.
- [Task assignment and readiness](../backendjava/src/main/java/com/easyback/assembly/AssemblyService.java): `syncOrder()`, line 83; `assign()`, line 100.
- [Trial lifecycle](../backendjava/src/main/java/com/easyback/operations/OperationsService.java): `finish()`, line 106; `resolve()`, line 128; `deliver()`, line 138.
- [Frontend shell](../frontend/src/main.tsx): `Shell()`, line 178.
- [Existing pilot boundary](PILOT_REMAINING_STATUS.md): implemented refresh does not claim notification delivery.

## 3. Which notifications to add

These are proposed defaults. “Owner” means the order's responsible account
with current order access. Department recipients are active users with the
permissions required for the action and destination, not hard-coded role names.

| Stage | Event and exact trigger | Who receives it | What it opens |
| --- | --- | --- | --- |
| MVP | `TASK_ASSIGNED`: worker changes from null/another worker in `assign()` | New assigned worker | `/tasks?task=<id>` (new URL selection) |
| MVP | `ORDER_RELEASED`: successful `release()` | Owner | `/orders/<id>` |
| MVP | `ORDER_SHORTAGE`: release finishes with missing requirements | Owner and warehouse coordinators with `orders.view + stock.view + stock.reserve` | Order and its stock section |
| MVP | `PREPARATION_REQUESTED`: explicit request or transition from fulfilled back to requested | Preparation managers with `orders.view + preparation.manage`; owner gets an order-level summary | `/preparations?preparation=<id>` for managers; order for owner |
| MVP | `DEFECT_REPORTED`: completed `DefectService.report()` | Warehouse receivers with `defects.view + orders.view + stock.view + stock.return`, repair managers with `defects.view + orders.view + defects.manage`, and owner | `/defects?case=<id>` for authorized defect readers; order summary for owner |
| MVP | `ORDER_READY_FOR_TEST`: actual transition to awaiting testing, including resolved rework | Operators with `operations.view + operations.start`; owner | `/operations/<orderId>` for operators; order for owner |
| MVP | `TRIAL_FAILED / TRIAL_ABORTED / TRIAL_INVALIDATED`: trial closes in the respective state | Resolvers with `operations.view + operations.resolve`; owner | Operations detail for resolvers; order summary for owner |
| Next | `REPAIR_COMPLETED`: `DefectService.finish()` | Warehouse acceptors with `defects.view + orders.view + stock.view + stock.receive` | Defect detail |
| Next | `PREPARATION_FULFILLED`: transition to fulfilled in `syncPreparation()` | Owner and warehouse issuers with `orders.view + stock.view + stock.issue` | Order stock |
| Next | `ORDER_COMPLETED`: passed trial completes order | Owner and delivery staff with `operations.view + operations.deliver` | Order or operations detail according to access |
| Next | `DELIVERY_DUE_SOON / DELIVERY_OVERDUE`: scheduled evaluator | Owner and order managers with `orders.view + orders.manage` | Order |

Use three severities: `INFO`, `WARNING`, `URGENT`. Assignments/readiness/completion
are informational, shortages/defects/upcoming delivery are warnings, and failed
or invalidated trials/overdue delivery are urgent. An aborted trial is a warning.

Deduplicate users when they qualify through several rules. Prefer the action
destination when the same person is both owner and department recipient.
Suppress routine notifications to the person who performed that action; scheduled
reminders have no actor. Keep an event record even if no eligible recipient exists,
and report that condition operationally. Permissions alone do not identify a
designated department lead; optional narrower subscriptions can be added later.

Do not create a notification for an unchanged worker assignment or for every
installation, stock movement, pause, or refresh. A shortage notification does
not automatically request preparation or modify stock.

## 4. Where the UI belongs

Add the bell beside the account/theme controls in `Shell()`, visible on every
authenticated screen. Clicking it shows the latest 10 accessible notifications,
unread styling, severity, time, “mark all as read,” and “view all.”

Add `/notifications` as a lazy-loaded inbox with all/unread and severity filters,
cursor pagination, per-item read action, loading/empty/error states, and Arabic
RTL styling. Reading an alert means it was read; it does not mean the defect,
shortage, or delivery issue has been resolved.

Route behavior:
- Orders and operations already have ID routes: reuse them.
- Add `?task=<id>` to `TasksPage`, opening its existing detail modal through
  the scoped task API. Support refresh, browser back, and modal close.
- Reuse `/defects?case=<id>`.
- Add `?preparation=<id>` to `PreparationsPage` to select/highlight that row
  regardless of its current filter/page; show a clear unavailable state.
- An owner without defect/operations permissions receives only an order-level
  summary with an order link, never the restricted report or trial notes.

Use keyboard-accessible controls, Escape dismissal and focus return for the
popover, a labelled unread badge, non-color severity labels, and tablet layout.
Do not mark the whole inbox read just by opening the bell.

MVP uses the inbox/badge without automatic toast replay. Later, urgent toasts
can use newly observed notification IDs; unread-count changes alone cannot
identify new alerts. Seed the seen-ID set on initial fetch so login does not
replay historical notifications.

## 5. Persistence and transaction design

Proposed migration: `V13__notifications.sql`, provided V13 is still free when
implementation begins. Use additive schema changes.

`notifications`:
- UUID `id`; `type`; `severity`; optional `actor_id` referencing users.
- Typed context IDs as needed: order, task, preparation, defect, trial.
- Non-null unique `dedupe_key`; UTC `created_at`.
- A small validated payload for safe event facts, such as a missing-piece count.
  Never copy free-text defect reasons, credentials, files, or arbitrary HTML.

`notification_recipients`:
- `notification_id` FK with delete cascade; `user_id` FK.
- Primary key `(notification_id, user_id)`; nullable UTC `read_at`.
- `scope_type` and `scope_id` identifying the permitted view
  (ORDER, TASK, DEFECT, PREPARATION, or OPERATIONS).
- `created_at` copied from the notification for efficient per-user ordering.
- Index `(user_id, created_at DESC, notification_id DESC)`; partial unread
  index using the same keys where `read_at IS NULL`.
- Validate scope/context consistency on creation. Render title/body/target from
  the permitted scope; do not serialize the full internal event to all recipients.

Store the event and recipient rows synchronously inside the successful business
transaction. A small separate writer bean using `Propagation.MANDATORY` can
enforce this rule. A database failure rolls back the business action too; that
is the explicit atomicity tradeoff for this pilot. The request handler must
surface a normal error and avoid reporting success.

Avoid a dependency cycle: notification code may use JDBC and a dedicated access
policy/identity helper, but should not inject OrderService, StockService,
AssemblyService, or OperationsService back into itself. Existing services
already call each other. Keep recipient resolution batch-oriented and avoid
loading every user's permissions separately for each generated notification.

Deduplication keys must describe a business occurrence:
- Task assignment: task ID + assignment version/new worker.
- Preparation: preparation ID + transition version.
- Trial outcome: trial ID + outcome.
- Order release/initial shortage: order ID + event type.
- Ready for testing: order ID + version captured on the actual transition.
- Deadline: order ID + delivery timestamp + reminder stage.

Use database uniqueness with conflict handling, not a check-then-insert race.
Do not deduplicate readiness forever by order ID: rework can legitimately make
the same order ready again. Existing generic event helper methods must not
blindly emit notifications for every audit/history entry.

Persistence must happen before commit. Spring transaction event listeners default
to AFTER_COMMIT; adding one alone would not provide atomic inbox persistence.
If delivery channels are added later, persist an outbox event in the transaction
and dispatch with retries afterward. See [Spring transaction-bound events](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html).

## 6. Access rules and API contract

The inbox is available to authenticated users who have completed mandatory
password change. It does not need a new blanket `notifications.view` permission.
Reuse `api.ts` for bearer tokens, refresh, CSRF on writes, and session expiry.
The client sends the existing CSRF header on writes. The established resource-server
policy exempts explicit Bearer requests from CSRF; cookie-based authentication
routes retain their existing CSRF protections. Notification routes do not change
that shared security contract.

Recipients are selected with effective permissions, including explicit denies,
active-user checks and record ownership. Validate those rights again when
listing/counting/reading. A stored recipient row is not a permanent grant.
Hide inaccessible content after role revocation or task reassignment; keep its
stored read state. If access is restored, the retained row can become visible again.

Use one policy for pagination, totals and mutations, applied before LIMIT.
Do not fetch a page first and then remove unauthorized entries: that produces
wrong counts and empty pages. The target API independently rechecks authorization.
No public endpoint lets clients create alerts or choose another recipient.

| Endpoint | Contract |
| --- | --- |
| `GET /api/v1/notifications?cursor=&limit=20&unreadOnly=false&severity=` | `{items, nextCursor}`; sort by createdAt DESC then id DESC; cap limit at 50; reject malformed cursors/filter values |
| `GET /api/v1/notifications/unread-count` | `{count}` using the same current visibility policy |
| `POST /api/v1/notifications/{id}/read` | Idempotent 204 for an accessible own item; preserve first read time; 404 for foreign/missing/inaccessible items |
| `POST /api/v1/notifications/read-all` | Mark the caller's accessible unread rows visible to this statement's database snapshot; 204; then refetch count/list |

An item contains `id, type, severity, title, body, createdAt, readAt, target`.
The target is a validated internal route derived from its currently authorized scope,
with the original owner's order-summary fallback when department access is revoked. Read mutations
only change recipient state and never execute the underlying business action.

On click, navigate to the authorized destination and attempt the read update;
if marking read fails, leave the count unchanged and expose a retry. A concurrent
permission change or removed target must render the existing denied/unavailable
state. Never cache notification bodies in browser localStorage.

## 7. Refresh and reminder behavior

One shared provider/hook mounted within the authenticated shell should poll the
unread count every 30 seconds, pause in hidden/offline state, and refetch on focus
and reconnect. Load recent items when the bell opens, and refresh visible
inbox/popover data through the same coordinator. Do not mount independent timers
in the bell, inbox and every page. TanStack Query supports interval refresh and
foreground control; each observer can have its own timer, so shared ownership
matters. See [TanStack polling](https://tanstack.com/query/latest/docs/framework/react/guides/polling).

Use user-ID-scoped query keys. Clear queries on logout/account switch as the app
already does. Invalidate notification queries after successful local workflow
and read mutations; receiving another user's event is handled by polling.
Permission reload changes should invalidate the notification cache too.
Background failures show stale/retry state without replacing the entire app.

For the next-stage deadline scheduler:
- Reuse the existing UTC `Clock` bean in `time/WorkClock.java` for deterministic tests.
- Use a configurable 15-minute scan. Candidate orders have `opened_at IS NOT NULL`,
  `status <> 'CANCELLED'`, and `delivered_at IS NULL`; include COMPLETED.
- Default proposal: one reminder within 24 hours before delivery, then one at
  or after the deadline. Use wall-clock elapsed time, with display in Africa/Cairo.
- On restart, create only the highest applicable unsent stage; do not send both
  a stale upcoming warning and an overdue warning together.
- Recheck candidate state inside a short transaction before insert, following
  the existing guard-lock order (security before catalog) to serialize with
  delivery/cancellation. Avoid holding global guards for the full scan.
- Use unique keys to handle repeated scans/multiple app instances. Keep the
  scheduled wrapper separate from its transactional evaluator so proxy behavior
  is explicit. Disable scheduled execution in integration tests and invoke the
  evaluator directly with a controlled clock.
- Delivery/cancellation stops new reminders. Existing notifications remain
  historical and display their event time; opening them fetches current state.

No daily escalation, shift-based suppression, or automatic retention deletion
is assumed. Start with retained pilot history and measure growth; a production
retention window and named escalation owner remain business decisions.

## 8. Implementation work packages

| Order | Files/work | Exit criteria |
| --- | --- | --- |
| 1. Foundation | New migration; `notifications/NotificationData.java`, repository/writer, access policy and service | Persist one event to multiple eligible recipients atomically; duplicate key creates no duplicate recipient; rollback leaves no alert |
| 2. Inbox API | New `NotificationController.java`; scoped list/count/read contracts | Permissions, ownership, revocation, pagination, and CSRF tests pass |
| 3. First complete flow | Hook `AssemblyService.assign()`; add `frontend/src/notifications/` components/hooks; bell and inbox routes in `main.tsx`; task URL selection | Manager assigns task, worker sees badge, opens correct task, marks read, and read state survives refresh/login |
| 4. Workflow coverage | Hook release/shortage, preparation lifecycle, defect report, readiness, and trial outcomes; add preparation URL selection | Each matrix event works once per transition, with correct audience and an accessible destination |
| 5. Follow-up handoffs/reminders | Repair ready, preparation fulfilled, order completed; scheduler/config | Test repair-to-warehouse handoff, completed-undelivered deadlines, catch-up and repeat scans |
| 6. Pilot verification | New browser tests, regression suite, update README/status docs | Arabic/tablet/keyboard flows, visibility rules, restart persistence and existing workflows pass |

Suggested new frontend files: `notifications/NotificationBell.tsx`,
`NotificationsPage.tsx`, `notification-api.ts`, `useNotifications.ts`, and
`notification-types.ts`. Reuse `ui.tsx`, existing styles, and `api.ts`.

Keep changes focused in `Assembly.tsx`, `Warehouse.tsx`, `main.tsx`, and relevant
mutation invalidation paths. `Defects.tsx` already implements the needed URL
selection. No replacement of routing, authentication, or query libraries is needed.

## 9. Required verification when implementing

- Per-user isolation: another user's ID cannot be listed/read; count reveals no
  inaccessible items; missing read prerequisites and explicit denies are honored.
- Permission changes with an existing session; disabled accounts; task
  reassignment; owner lacking defect/operations permissions sees only order content.
- Real transaction rollback, duplicate/retried event insertion, concurrent
  assignments, independent read state for two recipients, and repeat read calls.
- Shortage without a preparation request; explicit request; fulfilled request
  reopening; no duplicate on ordinary sync; new alert on a genuine later cycle.
- Initial testing readiness, rework resolution, aborted/invalidated trials, and
  repeated trial failure with a different trial ID.
- Stable pagination when timestamps tie/new items arrive; limit validation;
  read-all versus a concurrent newly committed notification.
- Deadline boundaries with controlled time, cancelled/delivered/draft exclusion,
  completed-undelivered inclusion, restart catch-up and concurrent scan deduplication.
- Browser: assign using one account and receive using another, refresh persistence,
  direct URL/back/close behavior, mark-read retry, Arabic RTL/tablet/keyboard,
  hidden/offline/reconnect behavior, logout cache clearing and no historical toast flood.

Use PostgreSQL-backed integration tests in the existing dedicated
`easyback_test` setup. Update `IdentityIT` reset handling for both new tables,
including orphan event rows that user cascades might not remove. Keep autonomous
scheduler execution off during those tests. Add `frontend/tests/notifications.spec.ts`
with existing localhost-only fixtures and cleanup conventions.

Planned verification commands, from this project:
`docker compose --profile test run --build --rm verify`;
from frontend: `npm run build`, then `npm run test:e2e` against local test fixtures.
These commands were not run for this documentation-only review.

## 10. Later scope and business choices

Low-stock thresholds need a new approved per-part policy: available versus
reserved stock, units, raw-material dimensions and usable remnants, replenishment
owner, and threshold re-entry behavior. Order shortage alerts can ship before
that policy exists.

Email, browser/mobile push, SMS/WhatsApp, sound, digests, user channel preferences,
and WebSocket/STOMP are later additions. The existing architecture proposes
STOMP, but it is not implemented in the pilot. If sub-second updates become
necessary, retain the inbox/API, add an authenticated transport, reconnect
catch-up, and an outbox for reliable delivery retries.

Proposed defaults ready for implementation are: in-app delivery, 30-second
foreground refresh, capability-based recipients, actor suppression, no historical
workflow backfill, and 24-hour/overdue reminders in the follow-up stage. Confirm
named department owners, any required immediate delivery, reminder timing and
retention before a production rollout; these choices do not block foundation work.
