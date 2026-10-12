# Worker Rejection, Repair and Scrap

Implemented 2026-10-12 in Java/PostgreSQL and the Arabic React application. This delivery handles finished serialized
pieces rejected by their assigned worker. Operations trials and final order completion are now delivered separately
in [OPERATIONS_STATUS.md](OPERATIONS_STATUS.md); unresolved serial-defect cases block acceptance.

## Custody and State

1. The assigned worker rejects their currently issued serial with a mandatory reason and current task version.
   An installed piece must be explicitly removed first. Global viewers cannot reject on behalf of another worker.
2. Rejection creates a persistent defect case, marks stock `REJECTED` and resets the task to pending. The piece remains
   bound to its task, requirement and actual recipient: it has not physically returned to the warehouse.
3. The rejected piece no longer covers usable requirement quantity. Existing fulfilled preparation requests reopen;
   replacement reservation is possible, but that occurrence cannot receive another piece until actual return clears custody.
4. Warehouse staff record actual defective receipt, a location and notes. Stock becomes `QUARANTINED`, allocation and
   task custody clear, and the worker assignment is retained. Reassignment/reissue are now possible.
5. Manufacturing starts repair (`IN_REPAIR`) and records completion (`REPAIRED`). Neither state is available for reservation.
6. Warehouse staff explicitly receive and inspect the repaired piece, record its location/result and make it `AVAILABLE`.
   The case closes as `RETURNED`. Reservation, issue and installation are new explicit actions using the original serial.
7. Authorized scrap is possible after physical return, from quarantine, repair or repaired-awaiting-receipt. Stock and
   case become `SCRAPPED` with a mandatory reason. The serial and full history remain and cannot be reused or restored.

One active defect case per serial is enforced by PostgreSQL. A repaired piece can have a later, distinct defect case;
the earlier case stays closed. Case details retain their original order/task/reporter while `pieceStatus` describes the
piece's current state, which may have changed after the case closed.

## Guards and Compatibility

- Rejected pieces cannot be installed, returned as good through the generic warehouse API, reassigned while held, or
  silently released by cancellation. Physical defective receipt is required first; no Quality cancellation approval was added.
- After defective receipt, cancellation is allowed while the detached piece's repair/scrap case continues independently.
- Generic quarantine restoration cannot bypass an active defect case. The previous inspected-return/quarantine flow
  for pieces without a worker defect case remains available; V8 does not fabricate cases for historical returns.
- All writes use the existing security-then-catalog guard order and a single database transaction. Task and case versions,
  append-only case events, assembly events, stock movements and security audit entries preserve the workflow history.
- Available/reserved warehouse balance excludes rejected, installed, quarantined, repair, repaired and scrapped states.
  New balance columns and serial filters expose those states separately. Raw preparation shortage calculations also exclude rejected pieces.
- Manufacturing and warehouse disposition remain available for archived references, except acceptance into usable stock
  requires an active catalog part. A defect does not erase an installation/removal history or alter machine configuration by itself.

## Permissions and Scope

| Permission | Access |
|---|---|
| `tasks.reject` | Reject own issued piece, with assigned-task view or global task/order view |
| `defects.view` + `orders.view` | All defect cases and their histories |
| `defects.manage` | Start/finish repair, with global defect/order view |
| `defects.scrap` | Scrap physically returned pieces, with global defect/order view |
| `stock.view` + `stock.return` | Actual defective receipt, with global defect/order view |
| `stock.view` + `stock.receive` | Actual repaired receipt/inspection, with global defect/order view |

Task viewers without global defect view see only cases they personally reported, even if their task view is global.
Other reporters' case IDs return 404. Original reporters retain historical case access after task reassignment while their
task-view permission remains. Case access does not grant warehouse or complete order access.

V8 grants the four new permissions to full security-administration roles only, preserving explicit user denials.
Existing worker/department accounts need the manager to grant the relevant permissions; no operational permissions are inferred from email or role name.

## API and UI

All routes have `/api/v1` prefix:

| Route | Body |
|---|---|
| `GET /defects`, `GET /defects/{id}` | Scoped list, or case and event history |
| `POST /assembly/tasks/{id}/reject` | `{version,reason}` using task version |
| `POST /defects/{id}/receive` | `{version,notes,location}` using case version |
| `POST /defects/{id}/repair-start`, `/repair-finish` | `{version,notes}` |
| `POST /defects/{id}/accept` | `{version,notes,location}` |
| `POST /defects/{id}/scrap` | `{version,notes}` |

`/tasks` adds a permission/state-aware rejection action. `/defects` provides global repair/warehouse queues or personal
reports, serial/order/reason search, state filtering, action dialogs and complete case history. Open cases are the default;
closed returned/scrapped cases are available through the state filter. Warehouse serials link to their active case when authorized.
Related task, stock, order and case caches invalidate after mutations; cross-device live push is not implemented.

## Verification and Limits

PostgreSQL coverage includes rejected custody, shortages, cancellation and restoration bypass guards, same-serial repair
and reinstallation, repeated defects, terminal scrap, replacement reservation, separate department permissions, worker
case isolation, live rejection-permission revocation, mandatory reasons, stale versions and concurrent duplicate rejection.
The browser workflow exercises worker rejection and personal reports, physical receipt, repair, warehouse acceptance,
reissue/installation, a second piece's scrap and retained history. Desktop/tablet/mobile screenshots cover the new screens.

Final verification passed: 7 Java unit tests, 53 real-PostgreSQL integration tests and all 10 Edge browser tests (70 total).
React production build passed. V8 migrated both development and test databases successfully; API health reports `UP`
and OpenAPI lists the new endpoints. New desktop/tablet/mobile screenshots were inspected in light/dark appearances.
The non-blocking Vite main-chunk warning remains (520.91 kB); defect, assembly and raw-stock screens are lazy-loaded.

No photographs/uploads, repair-worker scheduling, repair cost, repair duration calculations, automated defect diagnosis,
bulk disposition or dedicated failed-repair inspection/retry workflow are implemented here.
The receiving action records a successful repair inspection; a piece not accepted remains unavailable and can be scrapped.
Lists still return pilot-sized scoped datasets and page/filter in React. Production hardening and backups remain prerequisites.
