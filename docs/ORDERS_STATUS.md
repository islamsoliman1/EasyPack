# Manufacturing Orders Delivery

Implemented 2026-10-11 in `backendjava/` and `frontend/`. This is the request-management slice,
not warehouse reservation, material preparation or assembly execution.

## Lifecycle and Data

- `DRAFT`: editable code (on creation only), title, physical machine, published machine-specific BOM,
  responsible account, delivery timestamp and notes. Order codes normalize to uppercase and remain unique.
- Requirements are copied transactionally from the selected published machine BOM when creating a draft.
  Changing the source while still a draft replaces that draft's requirements. Other edits preserve their IDs.
- Each snapshot preserves repeated positions, source item ID, part ID/code/name, dimensions, quantity,
  expected installation minutes per piece and notes. A requirement row is a position with quantity, not
  a physical serialized piece or an individually assigned worker task.
- `OPEN`: explicit release freezes all editable order data and requirement snapshots. Later catalog/BOM
  edits do not propagate. Opening now automatically reserves available serialized pieces; issue is an explicit later action.
- V7 adds `IN_PROGRESS` and `AWAITING_TESTING`, driven by assembly tasks. Every quantity occurrence has a separate
  task; all installed waits for Operations, never final completion. Removal clears current assembly completion.
- `CANCELLED`: requires a nonblank reason and dedicated permission; allowed from draft/active orders, with history
  and requirements retained. Reservations are released; installed pieces must be removed and issued pieces/raw returned first.
  There is no quality-approval step, delete, reopen or completion endpoint.
- Creation/edit/release require a future delivery time, active physical machine, nonempty published BOM
  belonging to that exact machine, active referenced parts and an active eligible responsible account.
- Responsible accounts need either `orders.view` or `orders.view-assigned`. Eligibility is rechecked at release;
  deactivation or permission removal blocks opening until the draft is reassigned.
- Mutations use the security guard then catalog guard in a fixed order, optimistic versions and transactional
  actor/action/target audit records. Two competing changes with the same version cannot both succeed.
- Drafts may coexist for a machine. No automatic order supersession or duplicate-machine restriction is imposed.

## Access

| Permission | Capability |
|---|---|
| `orders.view` | List/read all manufacturing orders and their requirement snapshots |
| `orders.view-assigned` | List/read only orders where the signed-in user is the responsible account |
| `orders.manage` | Create/edit drafts; requires `orders.view`, `catalog.view`, `machines.view`, `boms.view` |
| `orders.release` | Open a draft; also requires `orders.view` |
| `orders.cancel` | Cancel a draft/active request after custody settlement, with a reason; also requires `orders.view` |

Assigned-only users need no catalog, BOM or user-administration access to read their order snapshot.
Direct URLs to someone else's order return 404. Assignment does not grant edit, release or cancellation rights.
The scoped responsible-person lookup returns only eligible active users' IDs, names and emails, and requires
draft-management prerequisites; it never exposes security roles or overrides.
V4 grants the new permissions only to existing full security-administration roles; department roles are unchanged.
Existing explicit denials still apply. Last-security-administrator protection remains based on the original nine permissions.

## API

Prefix `/api/v1/manufacturing-orders`:

| Route | Operation |
|---|---|
| GET `/` | Scope-filtered orders with requirement snapshots |
| GET `/{id}` | Authorized order details |
| GET `/responsible-people` | Eligible responsible-person lookup |
| POST `/` | Create draft: `code`, `title`, `machineId`, `bomId`, `responsibleId`, `deliveryAt`, `notes`, `version` |
| PUT `/{id}` | Update draft using the same input plus current `version` |
| POST `/{id}/release` | `{version}` |
| POST `/{id}/cancel` | `{version, reason}` |

`deliveryAt` is an offset/UTC timestamp stored as PostgreSQL `timestamptz`. The form explicitly labels the browser's
local timezone and converts the entered value to UTC; lists/details display dates in `Africa/Cairo`.
Lists are pilot-sized full responses with client-side search/status filtering/pagination, not server-side paging.
Opened requests currently cannot be reassigned or rescheduled; these require explicit audited workflows in a later slice.

## UI and Verification

`/orders` lists requests; `/orders/{id}` displays metadata and frozen requirements. Forms, action confirmations,
permission-aware controls, optimistic-conflict errors and responsive light/dark layouts follow the existing app.
Integration cases cover draft edits, snapshots, invalid source/date/assignee, active-reference checks, separate
transition permissions, assigned-only direct/list access, live revocation and concurrent release/cancel.
The browser test covers create/edit/release/reload/cancel, timezone conversion, a real restricted responsible account,
and desktop/tablet/mobile screenshots. Reserved E2E requests are cancelled and their fixture records archived afterward.
Verification passed: 3 unit tests, 23 PostgreSQL integration tests, 7 Edge browser tests and the production frontend build.
Order form/detail screenshots were inspected at desktop/tablet sizes in light/dark appearance; overflow checks also cover mobile.

Serialized warehouse receipts/balances, reservation/issue/returns and shortage preparation are now implemented in
[WAREHOUSE_STATUS.md](WAREHOUSE_STATUS.md). Measured raw stock/cutting is implemented in [RAW_STOCK_STATUS.md](RAW_STOCK_STATUS.md).
Worker assignment and installation/removal are implemented in [ASSEMBLY_STATUS.md](ASSEMBLY_STATUS.md).
Worker rejection/repair/scrap are implemented in [DEFECTS_STATUS.md](DEFECTS_STATUS.md).
Operations acceptance, rework/retest, successful completion and separate physical delivery are now implemented
in [OPERATIONS_STATUS.md](OPERATIONS_STATUS.md). Shift tracking remains future work. Opening an order does not mean it is completed.
