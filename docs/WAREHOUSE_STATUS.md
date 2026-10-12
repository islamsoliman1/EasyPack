# Serialized Warehouse Delivery

Implemented 2026-10-11. This slice covers ready-made serialized pieces in the single warehouse and their
allocation to manufacturing requests. Measured stock and zero-kerf cutting/remnants are now delivered separately
in [RAW_STOCK_STATUS.md](RAW_STOCK_STATUS.md).

## Stock Rules

- Each physical piece has a globally unique uppercase serial, catalog part, storage location, state and optimistic version.
- Atomic receipt accepts 1-200 serials for one active `SERIALIZED_PIECE` definition. Duplicate serials (including
  case-insensitive duplicates in the same batch) reject the entire batch. There is no silent partial receipt.
- Part kind, stock unit, shape and dimensions cannot change after any stock instance exists. A different specification
  needs a separate catalog definition. Existing catalog name changes do not change order requirement snapshots.
- States: `AVAILABLE`, `RESERVED`, `ISSUED`, `INSTALLED`, `QUARANTINED`. Reserved/issued/installed pieces have a requirement link;
  issued/installed pieces have a recipient. Installed pieces also have a task and active installation. Receipt never creates an installed-part record.
- Available and reserved counts remain physically in the warehouse; actual issue moves the piece out of warehouse custody.
  Quarantine is reported separately and never allocated to a request.
- Receipt, reservation, issue, return, cancellation unreservation and restoration each append an immutable movement row,
  preserving actor, time, serial, order/position where applicable, recipient, reference and notes. Balances derive from piece states.

## Request Fulfilment

- Opening a draft transactionally reserves available active parts against each requirement, ordered by position and then
  piece receipt time/ID. Repeated positions share the same available pool and cannot allocate the same physical piece twice.
- A warehouse user may reserve newly available stock for an open request. Initial partial reservation is valid;
  uncovered quantity is `required - reserved - issued`. Receipt by itself does not allocate stock to existing open requests.
- Existing requests opened before V5 may use the same explicit reservation action to allocate their stock.
- Selected reserved pieces (up to 200) can be issued together to the request's responsible account. The account must
  still be active and eligible for order access; each part must still be active. Invalid selection rolls back the whole issue.
- Request-level optimistic versions serialize reserve, issue, return, shortage creation and cancellation with the existing
  order transitions. Security/catalog guard locks are acquired in the same order across all stock writes.
- Issued pieces must be explicitly returned before cancellation. A good, inspected return becomes available; a defective
  return goes into quarantine. Both detach the active allocation, reopen the uncovered quantity and keep all movement history.
- A quarantined piece becomes available only through an explicit inspection/restoration action with a nonblank note.
  This is warehouse disposition, not the later worker-rejection/repair/scrap workflow.
- Cancelling a request releases remaining reservations and cancels active preparation requests. It does not make issued
  stock disappear or silently label an installed/defective part as good.

## Shortages

- Warehouse requests preparation for an uncovered requirement, with quantity and notes. One preparation record exists
  per requirement; an already active preparation request cannot be duplicated.
- Manufacturing can mark requested work `IN_PROGRESS`. Completion is derived when actual stock allocation covers
  the requirement (`FULFILLED`), not merely from pressing a completion button or recording a receipt elsewhere.
- A later return that reopens a previously fulfilled shortage changes its preparation state back to `REQUESTED`.
- This queue tracks missing-piece preparation. Raw source issue and cutting are now delivered in
  [RAW_STOCK_STATUS.md](RAW_STOCK_STATUS.md). Manufacturing costs and individual preparation-worker assignment remain pending.

## Access and API

Six new permissions are manager-editable. V5 grants them only to existing full security-administration roles;
explicit denials and the original last-administrator protection continue to apply.

| Permission | Access |
|---|---|
| `stock.view` | Warehouse balances, serial list and movement history |
| `stock.receive` | Receipt (with stock/catalog view); inspected restoration (with stock view) |
| `stock.reserve` | Reserve and request preparation; requires stock view and global orders view |
| `stock.issue` | Issue reserved pieces; requires stock view and global orders view |
| `stock.return` | Receive issued returns; requires stock view and global orders view |
| `preparation.manage` | Start preparation; requires global orders view |

Assigned-only users may read only their own request's coverage and allocated serials, without global warehouse access.
Direct requests to another user's order stock return 404. Stock permissions by themselves do not grant access to
other users' request details. Preparation queue reads require global orders view plus stock view or preparation management.

All paths have `/api/v1` prefix:

| Path | Methods/body |
|---|---|
| `/warehouse/balances`, `/warehouse/pieces`, `/warehouse/movements` | GET |
| `/warehouse/receipts` | POST `{partId,serials,location,reference,notes}` |
| `/warehouse/pieces/{id}/restore` | POST `{version,notes}` (piece version) |
| `/manufacturing-orders/{id}/stock` | GET scope-filtered coverage and allocated pieces |
| `/manufacturing-orders/{id}/stock/reserve` | POST `{version}` (order version) |
| `/manufacturing-orders/{id}/stock/issue` | POST `{version,pieceIds,notes}` |
| `/manufacturing-orders/{id}/stock/pieces/{pieceId}/return` | POST `{version,condition: GOOD or DEFECTIVE,notes}` |
| `/manufacturing-orders/{id}/stock/preparation` | POST `{version,requirementId,notes}` |
| `/warehouse/preparations` | GET preparation queue/history |
| `/warehouse/preparations/{id}/start` | POST `{version}` (preparation version) |

## UI and Boundaries

`/warehouse` has balances, serials, movement history and bulk receipt. `/preparations` shows the shortage queue.
Request details include coverage, serial selection, reservation, issue and return. The UI refreshes related request
versions and stock queries after movements. Lists currently load pilot-sized datasets and filter/page in React.

Tests cover atomic receipt/issue rollback, duplicate serials, raw/inactive rejection, specification locks, repeated-position
allocation, shared stock, cancellation/returns/quarantine/restoration, preparation coverage, access scope and concurrent writes.
Verification passed: 3 unit tests, 31 real-PostgreSQL integration tests and 7 Edge browser tests (41 total).
The React production build passed. Desktop, tablet and mobile screenshots were inspected in both themes,
including receipt, request coverage, allocated serials and preparation screens.
Browser fixtures have reserved E2E prefixes; cleanup returns issued fixture pieces, cancels fixture orders and archives
fixture parts/machines/models. Physical fixture stock and immutable movement history remain, attached to archived definitions.

Worker assignment, recipient selection, installed stock state and installation/removal are now delivered in
[ASSEMBLY_STATUS.md](ASSEMBLY_STATUS.md). Stock/preparation operations support open, in-progress, awaiting-testing, testing and rework orders.
Worker rejection, repair and scrap are now delivered in [DEFECTS_STATUS.md](DEFECTS_STATUS.md), with separate rejected/repair/repaired/scrapped balances.
Operations acceptance and separate delivery are now implemented in [OPERATIONS_STATUS.md](OPERATIONS_STATUS.md).
Still pending: shift/time tracking. There is no claim
of stock reconciliation/import, correction/backdating, physical counts or a production-ready warehouse deployment.
