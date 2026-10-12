# Catalog, Machines and BOM Delivery

Implemented on 2026-10-11 in `backendjava/` and `frontend/`, following the identity foundation.
This delivery adds reusable factory master data. It does not implement stock or manufacturing orders.

## Data Rules

- A model is a reusable design; a physical machine has its own unique serial number, model and location.
- Model/part codes and machine serial numbers are normalized to uppercase and cannot be changed after creation.
- Models, parts and machines can be archived, not hard deleted. Existing references remain readable.
- Catalog parts distinguish `SERIALIZED_PIECE` from `MEASURED_STOCK`. No physical part serials or balances exist yet.
- Dimensions are explicitly millimetres: rectangular length/width, round length/diameter, or a standard ready-made part without dimensions.
- Dimensions use decimal values with up to three fractional digits. A different specification needs a separate catalog code once used in a BOM.
- Raw-material stock categories are length or area; these are not an implementation of cutting, conversion or stock quantities.
- Ready-made definitions have installation minutes; measured materials have zero installation time and cannot be installed directly in a BOM.
- The same part may appear in different positions and different models. Position codes are unique within a BOM revision.
- A position has an integer quantity (1-10,000), notes and expected minutes per piece. Later orders will expand quantities into individually trackable occurrences.
- Only one draft exists per owner (model or physical machine). Revisions are numbered independently per owner.
- A physical machine has an independent parts list, even when another machine shares its model. No model edit propagates to a machine list.
- A first machine draft starts empty unless a published model revision is explicitly selected as its source. Subsequent drafts default to the machine's latest published revision. Copying another machine's revision or a different model is rejected.
- Model drafts default to the latest published model revision and cannot copy machine-specific revisions.
- Creating a ready-made part may optionally append a position to a model draft. The API creates/clones the draft when needed, and part creation plus linking share one transaction: any failure rolls back all changes and audit entries.
- Draft positions can be added, edited or removed. The BOM-wide optimistic `version` covers every position change.
- Publishing requires a nonempty draft and active owner/parts. For a machine list, the owner is the physical machine; archiving its model does not prevent maintaining that machine. Publication freezes position identities, names, dimensions, quantities and installation times.
- Catalog name/default-time changes do not rewrite existing BOM snapshots. New draft edits deliberately copy the selected catalog definition.
- Published revisions are immutable through all APIs. New work uses a new draft, with distinct item IDs; previous revisions remain available.
- Catalog mutations are transactional and serialized on a dedicated catalog guard row. Concurrent edits using the same version have one winner.
- Writes record actor, action, target and time in the existing audit log. Full before/after audit payloads and an audit UI are not implemented.

## Permissions

| Permission | Access |
|---|---|
| `catalog.view` | Models and shared part definitions |
| `catalog.manage` | Create, update and archive models/parts; also requires `catalog.view` |
| `machines.view` | Physical-machine list |
| `machines.manage` | Create/update/archive machines; also requires `machines.view` and `catalog.view` |
| `boms.view` | BOM revisions and snapshots; also requires `catalog.view` |
| `boms.manage` | Drafts, position mutations and publication; also requires both BOM/catalog view |

Machine-specific lists additionally require `machines.view` for reads and `machines.manage` for writes,
including direct `/boms/{id}` calls. Linked part creation requires both catalog and BOM read/manage permissions.

Manager-controlled roles and explicit overrides apply on every API request. UI hiding is not authorization.
V2 grants the six new permissions only to existing roles containing all nine security-administration permissions.
Other roles remain unchanged; explicit denials still apply. Last-administrator protection remains based on the nine security-administration permissions, not factory privileges.

## API

All paths have prefix `/api/v1`.

| Route | Methods |
|---|---|
| `/machine-models`, `/parts`, `/machines` | GET list; POST create |
| `/machine-models/{id}`, `/parts/{id}`, `/machines/{id}` | PUT update with `version` |
| `/machine-models/{id}/boms` | GET revisions; POST draft with optional `sourceBomId` |
| `/machines/{id}/boms` | GET independent machine revisions; POST draft with optional published source |
| `/parts/with-model` | POST `{part: PartInput, modelId, positionCode, quantity}` atomically creates a part and links it to a model draft |
| `/boms/{id}` | GET snapshot |
| `/boms/{id}/items` | POST add position with current BOM `version` |
| `/boms/{id}/items/{itemId}` | PUT update; DELETE with JSON `{ "version": ... }` |
| `/boms/{id}/publish` | POST with JSON `{ "version": ... }` |

Errors include `STALE_VERSION`, `DRAFT_EXISTS`, `BOM_LOCKED`, `BOM_EMPTY`, `SPECIFICATION_IN_USE`,
`RAW_MATERIAL_NOT_INSTALLABLE`, inactive-record errors and invalid dimensions. API DTOs validate values and precision before writes.
List endpoints currently return complete pilot-sized lists; React provides search, status filtering and pagination.
The BOM DTO includes nullable `machineId`: null denotes a shared model template. V3 preserves existing model revisions.
In React, new ready-made parts expose optional model/position/quantity fields. Machine rows link to their own lists;
the list screen supports empty creation, one-time model copying, repeated positions, edits, deletion and publication.
These lists describe planned parts, not an assertion that physical serial-numbered pieces have already been installed.
Server-side pagination and drawing/image uploads remain follow-up work for larger catalogs.

## Verification and Next Slice

The Java suite includes real PostgreSQL cases for both stock categories, dimensions, code uniqueness,
stale versions, machine identity, archived models/parts, repeated positions, snapshot immutability,
cloned revisions, direct authorization denial and concurrent draft/item changes. Additional tests cover atomic part/link
rollback, machine/model/sibling isolation, forbidden copy sources, archived machines and direct-route machine permissions.

Manufacturing order drafts, responsible-account assigned-only access, delivery timestamps and immutable requirements
are now implemented in [ORDERS_STATUS.md](ORDERS_STATUS.md). Serialized receipts, physical stock tracking,
reservation/issue, returns and shortage preparation are implemented in [WAREHOUSE_STATUS.md](WAREHOUSE_STATUS.md).
Measured raw-material balances, cutting and reusable remnants are implemented in [RAW_STOCK_STATUS.md](RAW_STOCK_STATUS.md).
Worker allocation, installation/removal and actual machine configuration history are implemented in [ASSEMBLY_STATUS.md](ASSEMBLY_STATUS.md).
Rejection and repair/scrap are implemented in [DEFECTS_STATUS.md](DEFECTS_STATUS.md).
Operations acceptance and separate delivery are now implemented in [OPERATIONS_STATUS.md](OPERATIONS_STATUS.md). Time tracking remains pending.
No real company model/part data has been invented. Browser fixtures use reserved E2E codes and are archived after testing.
