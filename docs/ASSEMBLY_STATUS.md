# Worker Assignments, Installation and Removal

Implemented 2026-10-12 in the existing Java/PostgreSQL and Arabic React project. Successful Operations testing is still
required before final completion; assembly itself stops at `AWAITING_TESTING` and cannot complete an order.
Operations is now delivered separately in [OPERATIONS_STATUS.md](OPERATIONS_STATUS.md), including rework,
configuration invalidation and successful completion. Assembly/stock accept `TESTING` and `REWORK` in addition
to the original active states; configuration changes during a trial invalidate it atomically.

## Tasks and Scope

- Release expands each frozen requirement into one task per quantity occurrence. `A1 / 1` and `A1 / 2` are separate
  physical slots even when they use the same catalog part. V7 backfills tasks for previously open pilot orders.
- Managers assign/unassign eligible active accounts per occurrence. Workers need `tasks.work` and either assigned-task
  view or global task/order view. Assignment is independent of the order's responsible account.
- Worker-only accounts see only currently assigned tasks through list, optional order filter, detail and action endpoints.
  Other users' task IDs return 404. Task access does not grant full order, warehouse, worker directory or machine-history access.
- Reassignment immediately changes read/action scope. It requires a reason when changing/removing an existing worker,
  and is blocked while a piece is issued or installed for that task. Return first, then reassign.
- Task states are `PENDING`, `IN_PROGRESS`, `INSTALLED`. Expected installation minutes and instructions come from the
  frozen requirement; each task includes the delivery timestamp, actual issued serial and relevant event history.

## Stock Custody and Compatibility

- Serialized issue now accepts optional `recipientId`. An assigned worker receives pieces only for their available tasks
  in the selected requirements. Each issued serial binds to exactly one task occurrence, in occurrence order.
- A batch that exceeds that worker's assigned capacity or mixes invalid requirements rolls back completely, including
  task events, stock movements and versions. One task cannot hold two issued/installed pieces.
- Compatibility bridge: omitting recipient defaults to the responsible account. Unbound legacy issue is allowed only
  while no task in that requirement has a worker assigned. It cannot be installed through the task API. Return legacy
  custody before assigning workers, then issue again to the actual assignment. Non-responsible recipients cannot use this bridge.
- Installed pieces have separate `INSTALLED` stock state and count. They remain allocated to the requirement but are
  not physically in the warehouse and are not counted as uninstalled issued pieces. Installation never debits stock twice.
- Returning a task-bound issued piece clears its task link, resets that task to pending, keeps its worker and preserves
  event/movement history. Installed pieces must be physically uninstalled before warehouse return.

## Installation and Physical Machine State

- Only the assigned worker can start or confirm installation, even if another account has global view/work privileges.
  Start requires an issued piece. Confirmation requires a started task, the correct recipient/requirement and active references.
- Installation records the serial, task, physical machine, slot/occurrence, worker, start/installation timestamps and notes.
  Partial unique indexes protect active serial, task and machine slot. Another order cannot occupy an already installed slot.
- `tasks.uninstall` permits removal within the viewer's scope: own tasks for assigned-only users, any task for global
  task/order viewers. Removal requires a reason and remains available when catalog references were archived.
- Uninstall closes the installation record, returns the piece to `ISSUED` with the same worker/task custody and resumes
  the task. It does not pretend that the piece returned to the warehouse. Reinstall or a later inspected return is explicit.
- Machine `configuration_version` increments on every install/uninstall, including reinstallation of the same serial.
  Normal machine version also increments to reject stale catalog edits. Current installed parts and complete removal
  history are exposed by `/machines/{id}/assembly` and the machine's new assembly screen.

## Order Progress and Concurrency

- Open orders become `IN_PROGRESS` when a task starts; installing every occurrence changes them to `AWAITING_TESTING`
  and records `assembly_completed_at`. There is no completed state, trial result or automatic acceptance in this delivery.
- Removing a piece clears current assembly completion, returns the order to assembly and changes configuration version.
  All-pending tasks return to `OPEN`; cancelled orders stay closed. Full coverage is distinct from installed progress.
- Stock and raw-stock operations accept the three active order states. Cancellation still releases reservations, but is
  blocked by installed pieces, issued pieces or issued raw sources. No Quality approval was added.
- Task optimistic versions change on assignment, custody, start, install, removal and return. All mutations share the
  existing security-then-catalog lock order, and update order/stock/task state in one PostgreSQL transaction.
- Timestamps measure elapsed wall-clock time only. Shift calendars, pauses, overtime and working-time calculations
  have not been implemented and must not be inferred from these timestamps.

## Permissions and API

V7 grants five new permissions only to full security-administration roles; explicit denials remain effective.

| Permission | Access |
|---|---|
| `tasks.view` | Global tasks with `orders.view`; machine installation history also requires `machines.view` |
| `tasks.view-assigned` | Own task list/details only |
| `tasks.assign` | Assignment and eligible worker directory, with global task/order view |
| `tasks.work` | Start/install own tasks, with task view |
| `tasks.uninstall` | Remove installed pieces within task-view scope |

All routes have `/api/v1` prefix:

| Route | Method/body |
|---|---|
| `/assembly/tasks?orderId=...` | GET scope-filtered list; filter optional |
| `/assembly/tasks/{id}` | GET task and append-only event history |
| `/assembly/workers` | GET eligible assignment accounts |
| `/assembly/tasks/{id}/assign` | POST `{version,workerId,notes}`; null worker unassigns |
| `/assembly/tasks/{id}/start`, `/install` | POST `{version,notes}` |
| `/assembly/tasks/{id}/uninstall` | POST `{version,reason}` |
| `/machines/{id}/assembly` | GET current/history installations and configuration version |
| `/manufacturing-orders/{id}/stock/recipients` | GET responsible/assigned recipient directory for authorized issue users |

The UI adds `/tasks`, permission-aware worker navigation, manager assignment dialogs, worker start/install/removal,
task history and `/machines/{id}/assembly`. Order details show progress and configuration version; warehouse issue chooses
the actual recipient. Related cached task, machine, order and stock queries refresh after local mutations.

## Verification and Boundaries

Integration coverage includes occurrence expansion, direct/list worker isolation, live reassignment, assignment/legacy
custody guards, atomic recipient capacity, final assembly without completion, cancellation/returns, removal/reinstall history,
concurrent installation and cross-order occupied-slot rejection. Existing identity/catalog/warehouse/raw suites remain applicable.

Verification passed: 7 Java unit tests, 46 real-PostgreSQL integration tests and all 9 Edge browser tests (62 total).
The new browser workflow uses two isolated worker accounts, exercises manager assignment and actual warehouse recipient
selection, checks forbidden cross-worker/order access, installs all four occurrences, blocks premature cancellation,
then removes, returns, reissues and reinstalls a piece. Current machine assembly and retained removal history are verified.
React production build passed; desktop, tablet and mobile screenshots were inspected in light/dark appearances.
Vite reports a non-blocking main-chunk size warning (518.76 kB); assembly and raw-stock screens are lazy-loaded separately.

Worker defect rejection and repair/scrap of finished serialized parts are now delivered in [DEFECTS_STATUS.md](DEFECTS_STATUS.md).
Still pending: shifts/time accounting, post-completion corrective work, drawings/uploads and production deployment.
There is no bulk assignment, offline work, CAD or automatic scheduling.
Pilot lists currently return full scoped datasets and page/filter in React.
