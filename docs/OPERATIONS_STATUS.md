# Operations Trials and Delivery

Implemented 2026-10-12 in `backendjava/` and the Arabic React frontend. This delivery adds
Operations acceptance, failure/rework/retest and actual handover, not shift accounting.

## Workflow

- Installing every required occurrence leaves the order `AWAITING_TESTING`, not completed.
- Operations starts a trial with 1-30 named checks and explicit acceptance criteria. Criteria are
  entered by the operator; the application does not invent technical acceptance values.
- Starting requires full current installation, no unresolved order defect, no outstanding issued
  serialized/raw custody, an active machine and matching order/configuration versions.
- A machine can have only one running trial, even across different manufacturing orders.
- Starting freezes the checks and a snapshot of **all** currently installed machine serials,
  positions and part names, and records the machine configuration version and actor/time.
- Every check must receive PASS or FAIL exactly once in the submitted result. A failed check
  requires observations; all results require an overall summary. Overall success is permitted
  only when every check passes. Invalid, missing, duplicate or foreign check IDs roll back.
- Success records `testedAt`, `completedAt` and the successful trial reference and changes the
  order to `COMPLETED`. There is no generic completion endpoint that bypasses a trial.
- Failure changes the order to `REWORK`. Operations records documented resolution after full
  reassembly, closed blocking defects and settled custody, then starts a **new** trial.
  Settings-only corrections can be documented without inventing part removal or stock movement.
- Explicit trial abortion also requires a reason, enters rework and requires resolution/retest.
- Any installation/removal on that physical machine while a trial runs atomically invalidates
  the trial, including a change performed through a different order. Old results cannot be submitted
  after reinstallation; the original configuration snapshot remains unchanged.
- Completed but undelivered machines cannot have their configuration changed through other
  active orders. This pilot freezes their tested configuration until handover, rather than leaving
  an undeliverable completed order with an obsolete successful trial.
- Actual delivery is a separate, reasoned, versioned action. It requires the successful trial's
  configuration to remain current, full assembly and no outstanding defects/custody. It records
  actor, time and recipient/handover notes; repeated delivery is rejected.
- Completed orders cannot be cancelled or have their tasks modified. Earlier trials and events
  remain readable. Post-completion corrective work/reopening is **not implemented** in this pilot.

## Access and API

Independent permissions: `operations.view`, `operations.start`, `operations.finish`,
`operations.resolve`, `operations.deliver`. Every mutation also requires view; finish covers
result recording and abortion. Department access does not require general orders, catalog or
warehouse access. A task worker receives none of these permissions implicitly.

V9 adds these permissions to full security-administrator roles, preserving explicit user denials.
The manager assigns other accounts their required permissions. Existing partial roles are not
silently promoted. Server-side permission checks apply immediately to subsequent requests.

All routes are under `/api/v1/operations`:

| Method | Route | Additional Permission |
| --- | --- | --- |
| GET | `/orders`, `/orders/{id}` | view only |
| POST | `/orders/{id}/start` | start |
| POST | `/trials/{id}/finish`, `/trials/{id}/abort` | finish |
| POST | `/trials/{id}/resolve` | resolve |
| POST | `/orders/{id}/deliver` | deliver |

The React queue is `/operations`; history/details are `/operations/:id`. It supports queue/status
filtering, search/pagination, user-entered checks, results, resolution and delivery forms, trial
selection, immutable serial snapshots and event history. Trial criteria are copied into the next
form for convenience but remain editable until that new trial starts. Order and task screens show
the new states. Completion and physical delivery are displayed separately.

Writes use the same security/catalog locks as assembly and stock, optimistic versions and one
database transaction. Concurrent start/finish have one winner; unsuccessful actions leave no
partial checks, configuration mutations, completion or audit events.

## Verification and Boundaries

Added real-PostgreSQL coverage for readiness, snapshot/check validation, success/delivery,
failure/resolution/retest, invalidation, cross-order configuration changes, pending raw custody,
open defects, concurrent start/finish/abort, least-privilege access and live revocation.
The Edge browser test drives the same workflow through an Operations-only account, verifies
restricted navigation/API access and captures desktop/tablet/mobile and dark-form screenshots.
Current verified counts are maintained in [FOUNDATION_STATUS.md](FOUNDATION_STATUS.md).

Browser tests mutate localhost development data. Successful completed test orders intentionally
remain as audit fixtures with archived catalog identities and disabled test accounts; cleanup
does not rewrite completed history or bypass completion locks with direct production SQL.

Not included: approved company-specific reusable checklist templates, attachments/drawings,
automatically creating serialized defect reports from a failed general machine check, time/shift
accounting, reopening completed orders, post-delivery servicing, analytical delay reports or
production deployment. Failed machine checks and worker piece-defect cases remain distinct;
piece defects use the existing repair/scrap workflow when a defective serial is identified.
