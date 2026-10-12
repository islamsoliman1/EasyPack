# Measured Stock and Cutting Delivery

Implemented 2026-10-12 in Java Spring Boot/PostgreSQL and the existing Arabic React application.
The agreed rules are zero calculated saw kerf and return of every positive reusable remainder, with no minimum size.

## Receipt and Custody

- Every physical sheet/bar has its own unique uppercase code, catalog raw-material definition, actual millimetre
  dimensions, location, status, version and optional parent source. Receipt accepts 1-200 same-sized units atomically.
- `LENGTH` is tracked in millimetres and displayed in metres. `AREA` is tracked in square millimetres and displayed
  in square metres. Decimal arithmetic is used in Java/PostgreSQL; dimensions allow three decimal places.
- Rectangular length-stock retains the catalog cross-section width; round length-stock retains the catalog diameter.
  Sheets may have different actual lengths/widths, including returned offcuts. Specifications become immutable after receipt.
- States: `AVAILABLE`, `ISSUED`, `CONSUMED`, `SCRAPPED`. Available units are in the warehouse. A whole unit is
  issued to one open order's `IN_PROGRESS` preparation request before cutting. A source cannot be issued twice.
- An issued, uncut source may be returned with a mandatory inspection/reason note. Return remains possible if
  the preparation was covered by another stock receipt or the catalog definition was subsequently archived.
- Cancellation is blocked while any raw source for the order is issued, even when its finished-piece shortage is covered.

## Cutting Rules

- One transaction cuts one issued source into 1-200 copies of the target preparation's serialized catalog part.
  The output quantity cannot exceed the current uncovered quantity. Each output needs its own unique Serial Number.
- Length cuts require matching shape and cross-section width/diameter and cut sequentially along the length.
- Sheet cuts use an explicit uniform rectangular grid. Quantity must divide exactly by the chosen column count;
  rows are derived. Optional 90-degree rotation is checked against both physical source dimensions.
- This is a deterministic guillotine layout, not automatic nesting or an optimizer. Area sufficiency alone never proves fit.
  Mixed part types, irregular shapes, holes and arbitrary nesting are outside this delivery.
- The layout yields at most two non-overlapping remnants: the full-width end strip and the side strip beside the
  used rows. Every positive region defaults to return, including the smallest representable dimensions; no saw kerf is deducted.
- Marking a remainder unusable records that complete region as actual scrap, requires a reason, and keeps it out of
  available stock. Output amount + returned amount + actual scrap exactly equals source amount. An exact fit creates no remnants.
- Returned regions get new `R-<UUID>` codes and actual dimensions, linked to their parent. They can be issued and cut again.
- Confirmation atomically consumes the source, receives finished serialized pieces, reserves them specifically to the
  preparation's requirement, records output provenance, creates remnants/scrap and updates coverage. It does not steal
  output for an earlier position or another order. Invalid geometry, duplicate serials or any failed write roll everything back.
- Geometry/profile checks do not certify material grade or thickness. Operators select the correct catalog raw material;
  explicit material-grade/thickness compatibility and manufacturing recipes have not yet been modeled.

## Access and Concurrency

Three manager-editable permissions were added. V6 grants them only to existing full security-administration roles,
preserving explicit user denials and last-administrator protections.

| Permission | Prerequisites and action |
|---|---|
| `stock.view` | Read raw balances, units, movement history and cut history |
| `raw.receive` | Stock/catalog view; receive physical raw units |
| `raw.issue` | Stock/global orders view; issue or return uncut sources |
| `raw.cut` | Stock/global orders view; preview and confirm cut/output receipt |

Assigned-only order access does not grant global raw-stock access. All mutations use security/catalog guards in the
existing lock order. Source versions protect custody transitions; preparation versions and live shortage checks protect
issue/cutting. A preview is read-only; confirmation rechecks everything and the UI invalidates its preview after input changes.

All routes have `/api/v1/warehouse/raw` prefix:

| Route | Method/body |
|---|---|
| `/balances`, `/units`, `/movements`, `/cuts` | GET |
| `/receipts` | POST `{partId,codes,lengthMm,widthMm,location,reference,notes}` |
| `/units/{id}/issue` | POST `{version,preparationId,preparationVersion,notes}` |
| `/units/{id}/return` | POST `{version,notes}` |
| `/units/{id}/cut-preview`, `/units/{id}/cut` | POST `{version,preparationVersion,serials,columns,rotated,returnFirst,returnSecond,notes}` |

Movements preserve actor/time, source, preparation/order, amount, reference and notes. Cut history preserves layout,
actual scrap/return totals and every output serial. There is no deletion or backdated editing API.

## UI and Verification

`/raw-stock` provides balances, physical sources/remnants, movements and cut history, with receipt, issue, uncut return,
preview and confirmation dialogs. The preparation queue links directly to raw issue with its preparation preselected.
Large raw tables have stable column widths and horizontal scrolling on tablets. Existing identity/theme/navigation remain.

Tests cover exact decimal conservation, tiny remnants, rotation, invalid grids, atomic receipt/cut rollback, profile/specification
protection, overproduction, source/preparation versions, cancellation, covered shortages, archived returns, live authorization and
concurrent cutting. Browser coverage follows sheet and round-bar receipt through issue/return/cut, verifies generated reserved
serials, both remainders, movement history, preview invalidation and desktop/tablet/mobile layouts in light/dark themes.
Browser cleanup returns issued fixture sources, cancels fixture orders and archives fixture catalog records; it retains stock/history.
Final verification passed: 7 unit tests, 38 PostgreSQL integration tests and 8 Edge browser tests (53 total), plus the React
production build. Screenshots were inspected; narrow raw-table columns were corrected and the browser suite rerun successfully.

## Remaining Work

Worker assignments and installation/uninstallation are now delivered in [ASSEMBLY_STATUS.md](ASSEMBLY_STATUS.md).
Raw custody/cutting accepts open, in-progress, awaiting-testing, testing and rework orders. Worker rejection with repair/scrap of finished pieces
is now delivered in [DEFECTS_STATUS.md](DEFECTS_STATUS.md). Operations trials are now delivered in [OPERATIONS_STATUS.md](OPERATIONS_STATUS.md),
including blocking outstanding raw custody before testing. Shift/time tracking remains pending. This delivery does not implement costing,
supplier purchasing, arbitrary raw disposal/corrections, stock counts/reconciliation, irregular nesting or production deployment.
Lists still use pilot-sized full responses with React search/pagination.
