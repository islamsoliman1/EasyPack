# Factory dashboard, machine chat and designs

The signed-in landing page is the factory dashboard for accounts with
`machines.view` or `reports.view`. The account and password screen is available
at `/account`. Accounts without either dashboard permission keep the account
screen as their landing page.

## Dashboard

`GET /api/v1/factory-dashboard` requires `reports.view`. It returns all-time
order counts and status distribution, active machines, completed and delivered
orders, undelivered overdue orders, open defects, available and quarantined
pieces, running work sessions, unassigned tasks, shortages and assembly totals.
Shortages and assembly totals exclude draft, cancelled and completed orders.
Completed orders awaiting delivery remain eligible for overdue delivery counts.
Counts represent recorded workflow data, including open sessions that have not
been stopped; they do not measure physical machine utilization.

Machine cards use the existing machine and manufacturing-order endpoints.
Order visibility retains the existing full or assigned-order permission scope.
Factory statistics require the independent reporting permission. The cards can
be searched and filtered, and refresh every 15 seconds.

## Machine chat

Migration `V102__machine_chat.sql` creates persistent messages and per-user read
cursors. Chats are internal to authenticated users with `machines.view`;
this permission provides access to every machine chat. A chat is separate for
each physical machine, rather than each model or manufacturing order.

Endpoints:

- `GET /api/v1/machine-chat/unread`: unread counts grouped by machine, excluding
  messages sent by the current user.
- `GET /api/v1/machines/{id}/chat?before={messageId}`: up to 50 chronological
  messages from the newest matching page, plus `hasMore`.
- `POST /api/v1/machines/{id}/chat`: `{ "body": "..." }`, 1–2000 characters.
- `PUT /api/v1/machines/{id}/chat/read`: `{ "through": 123 }`. The cursor only
  advances and must reference a message from the same machine.

The interface polls every five seconds and loads older messages on demand.
Only an open, focused chat marks messages as read. Sending requires Bearer
authentication and current machine viewing permission; revocation applies to existing sessions.
Machine cards and the machine catalog both show the chat button and unread count.

## Designs

Machine cards, the machine catalog, the part catalog and BOM component rows
open the existing file service with the appropriate `MACHINE` or `PART` ID.
Uploads remain persisted in PostgreSQL, with server-side access checks,
uploader metadata, download, preview and version-checked removal. Multiple
design files can be attached. Files for a part definition are shared wherever
that part appears; there is no separate drawing for each stock serial number.

Supported formats are valid PDF, PNG and JPEG, up to 10 MiB per file. PDF
preview is now available alongside image preview. Native CAD formats are not
accepted by the existing file service. Upload and removal require
`files.manage` in addition to access to the target record.

## Verification

Frontend: `npm run build` from `frontend/`, and
`node scripts/Check-Translations.mjs` from the project root.

Backend: run the existing dedicated-database integration suite. New cases in
`IdentityIT` cover dashboard counts and shortage rules; chat persistence,
machine isolation, unread counts, monotonic read cursors, pagination, input
validation, CSRF, anonymous access and live permission revocation. The suite
requires a disposable database explicitly named `easyback_test` and resets it.

Verified locally on 2026-10-22: frontend production build, translation audit
(966 UI keys), and combined Docker image build passed. The first full backend
run passed 92 of 93 integration cases; the remaining new test incorrectly
expected Bearer-authenticated requests to require CSRF. After correcting that
expectation, both new integration cases and all unit tests passed in the focused
verification run. Browser checks confirmed real dashboard counts, sending and
rendering a message, PDF upload to a machine, and separate part attachments from
the machine BOM. Arabic desktop and English tablet layouts were inspected;
at a 768-pixel viewport the document width was also 768 pixels.

The local preview uses a separate database with synthetic records. No main or
demo database was modified by these checks. The current application deployment
must be rebuilt to use the new backend endpoints and apply the migration.
