# Initial implementation plan: local project planning app

Status: Initial implementation delivered November 9, 2026. See [implementation and verification record](../../implementation-status.md). The user approved the designs and authorized implementation. This file remains at its requested path as the original scope and acceptance checklist.

Planning date: November 9, 2026.

Originally delivered as a planning-only document. The user subsequently approved the screen designs and explicitly requested implementation; the application and Dockerfile are now included in the repository.

## 1. Goal and agreed stack

Build a minimalist, locally hosted project planning application for a human and agents. It provides a React browser client, a complete REST API, and an MCP interface over shared application services and one SQLite database.

The stack follows the final recommendation in the conversation **Lightweight API Server Options**:

| Layer | Choice |
| --- | --- |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Frontend | React, TypeScript, Vite |
| Persistence | SQLite, SQLAlchemy 2.x, Alembic migrations |
| Agent interface | Official Python MCP SDK, Streamable HTTP |
| API contract | FastAPI OpenAPI; generated TypeScript REST types |
| Python dependencies | uv with a committed lockfile |
| Frontend dependencies | npm with a committed lockfile |
| Packaging | One multi-stage Docker image and one application container |
| Durable data | Mounted local volume containing the database and attachments |

Use supported, mutually compatible dependency releases and lock exact versions during implementation. SQLAlchemy remains within the agreed 2.x family. Verify MCP SDK and target client compatibility before selecting its release; do not copy version-specific SDK examples without checking the pinned release.

No PostgreSQL, Redis, Celery, separate Nginx, server-side React rendering, or running Node.js process is needed in the final container. Vite produces the static frontend bundle, and FastAPI serves it alongside the APIs. See the official [Vite build documentation](https://vite.dev/guide/build) and [FastAPI container guidance](https://fastapi.tiangolo.com/deployment/docker/).

## 2. Confirmed requirements

### Projects

- A project owns its description, sprints, items, labels, and permission assignments.
- Multiple projects exist in the same local installation.
- Only human administrators create projects and manage users and permissions.
- A project creator receives full project permissions. Other users have no project access until granted.

### Sprints

- Sprints have a name and explicit ordering within a project.
- There are no required scheduled start/end dates.
- Lifecycle: `planned -> active -> closed`. Display `planned` as **Not started** in the client. There is no stopped or paused state.
- Each project has at most one active sprint; different projects may have active sprints simultaneously.
- Starting records `started_at`; closing records `closed_at`.
- A sprint can close only if every item remaining in it is `done` or `cancelled`.
- Move unfinished items to another sprint before closure, or use an atomic close-and-move command. Moving preserves state unless an explicit state change is requested separately.
- Completed work means `done`. Cancelled items are a separate terminal outcome and may remain in a closed sprint, but do not count as completed work.

### Items

- Types: `story`, `task`, `bug`.
- States: `open`, `in_progress`, `blocked`, `done`, `cancelled`.
- `cancelled` replaces the initially suggested `incomplete` state and means work will no longer be pursued.
- Fields include title, description, assignee, labels, priority, type, state, and optional sprint.
- Items with no sprint automatically appear in **Backlog**. Backlog is a derived view, not a stored sprint.
- Parent/child and related links are supported. An item has at most one parent and can have multiple children. Related links are symmetric.
- Add directed **Blocked by** links. An item may have multiple blockers; the reverse display is **Blocks**. Entering Blocked requires at least one valid Blocked by link.
- If a Blocked item's remaining blockers are all Done, show a ready indicator and ask whether to move it to In progress each time its detail view is opened. Do not resume automatically or permanently dismiss this prompt.
- Cancelling an item that blocks other items requires confirmation listing the affected items; cancellation removes those Blocked by links atomically.
- If the last Blocked by link is removed from a Blocked item, automatically move that item to Open. This also applies when removal results from cancelling or deleting its last blocker.
- Links stay within a project; linked items can be in different sprints or Backlog.
- Items support file attachments, common image previews, text previews, and comments.
- **Complete item activity history is a required feature.** Record every committed change affecting an item, whether performed by a human, an agent, or an automatic application action. Users can view a durable, chronological historical activity list from the item's Activity tab; this is not optional or limited to comments.

### Users and agents

- Initial startup presents a setup screen for choosing the first human administrator's username and password.
- Administrators can create human users or agent users.
- Creating an agent generates a unique readable username and a random UUID password.
- An agent is a user type, not a privileged role. Humans and agents use the same project permission checks.
- Each project grants separate view/create/update/delete permissions for sprints, items, comments, and attachments. Project details also have view/update permissions; project creation and deletion remain administrative operations in this initial version.
- Agents can use both REST and MCP, subject to their permissions.

### Client and appearance

- Standard left navigation, header, and main content area.
- Main screens: Home, Planning, List, Sprint, Item detail.
- Include supporting project management, user administration, project permissions, setup/login, and appearance settings screens.
- Support Light, Dark, and System modes and a selection of common accent color themes.

### Deployment

- Local access only for this version, including agents running on this machine or in local containers.
- Include implementation tasks to generate a Dockerfile and Compose configuration, then verify the packaged application.
- Remote/public access is deferred.

## 3. Implementation defaults

These resolve routine details that were not specified individually. They are design defaults, not additional answers attributed to the user.

| Detail | Initial behavior |
| --- | --- |
| Priority | `none`, `low`, `medium`, `high`, `urgent`; default `none` |
| Required item fields | Title and type; state defaults to `open` |
| Assignee | Optional, one enabled human or agent with item view permission in the project |
| Descriptions/comments | Markdown; raw HTML disabled; text editor with preview |
| State changes | Explicit user/agent actions except the required Blocked -> Open transition when its last Blocked by link is removed; no parent/child rollup or state changes merely from sprint movement |
| Cancelled reason | Optional comment rather than a required new field |
| Closed sprints | No new members or in-place item state changes; items may move out; descriptive fields, comments, links, and files remain editable with permission |
| Reopening closed work | Move the item to Backlog or a nonclosed sprint and change its state in one item update |
| Sprint reopening | Not provided initially; closing is final |
| Empty sprint closure | An active sprint with zero items can close |
| Ordering | Manual sprint order; manual item rank per Backlog/sprint, with deterministic ID tie-breaks |
| Resource deletion | Permanent deletion with explicit permission; UI confirmation; audit tombstones retained |
| Sprint deletion | Only an empty, not-started sprint can be deleted |
| Project deletion | Administrator only; only an empty project; no implicit bulk deletion |
| Item deletion | Allowed in Backlog or a nonclosed sprint; closed sprint items must first be moved out |
| Comment/file deletion | Allowed with their resource delete permission, including on closed sprint items |
| Comment editing | Project comment update/delete grants apply to any comment, with author and editor attribution |
| Saved queries | Filter state in shareable/bookmarkable URLs; no persisted saved-query entity initially |
| Updates from agents | Poll the visible screen every 10 seconds and refetch on focus; no WebSocket/SSE application feed initially |
| File limits | Default 25 MiB per attachment; text preview reads at most 1 MiB; configurable limits |

## 4. Architecture and repository structure

```text
Browser React app ---- REST /api/v1 ----+
                                      |
REST clients -------- REST /api/v1 ----+--> authentication + project authorization
                                      |              |
Agents -------------- MCP /mcp --------+       application services
                                                     |
                                              SQLAlchemy + SQLite
                                                     |
                                              attachment file store
```

REST and MCP adapters call the same service methods. Validation, authorization, transactional changes, and activity attribution must not be reimplemented in separate adapters. Neither interface exposes direct SQL or direct filesystem access.

```text
backend/
  pyproject.toml
  uv.lock
  alembic.ini
  migrations/
  app/
    main.py                 # Application factory, lifecycle, routes, static client
    config.py
    api/                    # REST routers and request/response models
    auth/                   # Passwords, sessions, tokens, principal resolution
    services/               # Use cases and authorization policy
    models/                 # SQLAlchemy mappings
    db/                     # Engine, transactions, connection configuration
    mcp/                    # Typed tools, transport authentication, lifecycle
    storage/                # Attachment ingestion, previews, cleanup
  tests/
frontend/
  package.json
  package-lock.json
  src/
    app/                    # Routes, authenticated shell, providers
    api/                    # Generated types and small fetch wrapper
    features/               # Projects, planning, list, sprint, items, users
    components/             # Shared accessible UI elements
    styles/                 # Tokens, mode and accent definitions
  tests/
docs/
  todo/pending/initial_implementation.md
  api.md
  agent-setup.md
  operations.md
Dockerfile
.dockerignore
compose.yaml
README.md
```

Use synchronous SQLAlchemy sessions with FastAPI threadpool execution for database-bound services. Async MCP handlers dispatch those blocking services through a worker thread. Never share a session between requests/tasks or perform blocking database/file operations on the event loop.

Serve REST and MCP routes before the static client fallback. Missing API/MCP routes must return their protocol errors, not `index.html`. Support deep links such as `/projects/{id}/items/{itemId}` after refresh.

## 5. SQLite schema and invariants

Use opaque UUID identifiers serialized as strings. The public user ID is independent of an agent's secret UUID password. Store timestamps in UTC and serialize them as ISO 8601 values. Store mutable entity versions as increasing integers.

### Tables

| Table | Main columns and constraints |
| --- | --- |
| `installation` | Singleton ID, `initialized_at`; serializes one-time initial setup |
| `users` | `id`, unique normalized `username`, display name, `kind` (`human`/`agent`), `is_admin`, password hash, enabled flag, timestamps, version; agents cannot be admins |
| `user_preferences` | `user_id` PK/FK, `appearance` (`light`/`dark`/`system`), `accent`, version |
| `auth_sessions` | ID, user FK, token hash, kind (`browser`/`api`), creation/expiry/revocation timestamps; no plaintext session tokens |
| `projects` | ID, unique immutable key, name, description, next item number, creator FK, timestamps, version, grant revision |
| `project_permissions` | Project FK, user FK, resource enum, four boolean CRUD grants; unique `(project_id,user_id,resource)` |
| `sprints` | ID, project FK, name, integer position, state, started/closed timestamps, version |
| `items` | ID, project FK, project-local number, title, Markdown description, type, state, priority, assignee FK nullable, sprint FK nullable, integer rank, reporter FK, timestamps, version; unique `(project_id,number)` |
| `labels` | ID, project FK, display name, normalized name, version; unique `(project_id,normalized_name)` |
| `item_labels` | Project FK, item FK, label FK; primary key `(item_id,label_id)` with project-scoped composite FKs |
| `item_links` | ID, project FK, kind (`parent_child`/`related`/`blocked_by`), source item FK, target item FK, creator FK, timestamp, version; uniqueness for normalized endpoints/kind |
| `comments` | ID, project FK, item FK, author FK, Markdown body, timestamps, last editor FK, version |
| `attachments` | ID, project FK, item FK, uploader FK, original filename, internal storage key, detected MIME type, byte size, checksum, storage state, created timestamp, version |
| `storage_jobs` | ID, optional attachment FK, internal storage/temp keys, operation (`finalize`/`delete`), state, attempt count, timestamp; survives metadata deletion for crash recovery |
| `activity_events` | ID, project/item references and immutable ID snapshots, actor user ID where applicable, actor name/kind snapshot, interface (`rest`/`mcp`/`system`), action, entity type/ID, timestamp, changed-field before/after data, operation/correlation ID, optional triggering event/initiating user; append-only |
| `idempotency_records` | Principal FK, key, request hash, safe response metadata, expiry; unique `(principal_id,key)` |

### Constraints and indexes

- CHECK constraints for states, types, priorities, user kinds, positive item numbers, and valid preference values.
- Unique partial index on `sprints(project_id) WHERE state = 'active'` enforces one active sprint at the database level.
- Sprint timestamp constraints: planned has no lifecycle timestamps; active has a start and no closure; closed has both and closure is not before start.
- Composite foreign keys keep item/sprint, link endpoints, label assignments, comments, and attachments within their project. Add the corresponding parent-table composite UNIQUE constraints required by SQLite.
- A nullable sprint FK represents Backlog. Never insert a fake Backlog sprint.
- Store parent links only as parent -> child. A partial unique index on child ID for parent links enforces a single parent. A write-serialized service check prevents ancestry cycles and self-links.
- Store related links with lexically sorted endpoint IDs so reverse duplicates cannot occur. Return parent/child direction relative to the requested item.
- Store `blocked_by` as dependent/source -> blocker/target. Do not create a second stored `blocks` edge; derive the inverse display. Permit many blockers per item and many dependents per blocker. Unique `(kind,source_item_id,target_item_id)` rejects duplicates. Add an index on `(kind,target_item_id,source_item_id)` for cancellation impact lookup. Reject self-links, cancelled blocker targets and dependency cycles as an implementation default; hierarchy and dependency cycle checks are separate.
- Index item query fields, including `(project_id,sprint_id,state,rank,id)`, `(project_id,type)`, `(project_id,assignee_id)`, priority, and update time. Index reverse link lookup, labels, comments `(item_id,created_at,id)`, permissions, and activity `(project_id,created_at,id)`.
- Index item history by immutable `(item_id_snapshot,created_at,id)` as well, so a complete ordered history can be retrieved independently of a live item FK and timestamps with equal values have a stable order.
- Allocate project-local item numbers atomically in the item creation transaction; expose a stable readable key such as `LOCAL-42`. Never recycle numbers.
- Grant rows use resource values `project`, `sprint`, `item`, `comment`, `attachment`. Reject project create/delete grants because those operations are admin-only in v1. A grant for a write action requires that resource's view grant.
- Disabled users retain identity and attribution. Do not hard-delete users with authored history.
- Define FK deletion behavior explicitly: dependent item metadata can cascade only after required delete checks and durable file cleanup jobs are recorded. Storage jobs retain internal keys if their attachment FK becomes null. Activity references use nullable live FKs plus immutable identity snapshots, preserving audit tombstones after entity deletion; deleted-project history is admin-only.

### Connections and transactions

- Initialize WAL mode. Set `foreign_keys=ON` and a bounded busy timeout on every connection; use durable synchronization settings. Foreign key enforcement must be explicitly enabled, as described in [SQLite foreign key documentation](https://www.sqlite.org/foreignkeys.html).
- Use a local filesystem volume. WAL allows reads alongside a writer but still has one writer at a time and does not support a network filesystem across hosts; keep write transactions short. See [SQLite WAL documentation](https://www.sqlite.org/wal.html).
- Configure transaction control deliberately for the chosen Python sqlite3/SQLAlchemy versions; do not rely on legacy driver defaults for critical serialization. Follow the [SQLAlchemy SQLite transaction guidance](https://docs.sqlalchemy.org/en/20/dialects/sqlite.html#transactions-with-sqlite-and-the-sqlite3-driver).
- Acquire the write reservation before read/validate/write operations that must serialize: sprint start/close, membership changes, hierarchy/dependency cycle checks, blocked transitions, blocker removal/cancellation/resume, numbering, ordering, permission changes, and first-admin setup. Retry only safe bounded operations; return a retryable busy response rather than hanging.
- Check permissions and entity versions within the mutation transaction. Commit activity events in the same transaction as their changes.
- Use Alembic migrations from the first release. Migration failure prevents readiness; do not silently start against an incompatible schema. See [Alembic's migration tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html).

## 6. Domain behavior and authorization

### Sprint lifecycle

1. Create a sprint in `planned`, at the end of the project's manual order.
2. Reorder sprints with an atomic ordered-ID command. Require a complete, duplicate-free list and current sprint versions to prevent lost ordering updates.
3. Start a planned sprint. Reject if another sprint is active. Set `started_at` once using server time.
4. Populate planned/active sprints from Backlog or another nonclosed sprint. A move never resets an item's state.
5. The close preview returns counts by state, unfinished item IDs, and available destination sprints.
6. Closing without a rollover destination fails if any item is outside `done`/`cancelled`.
7. Closing with `move_unfinished_to_sprint_id` moves all unfinished items to that same-project planned/active destination, preserves their states, appends their ranks deterministically, then closes the source in one transaction. Backlog is not a rollover destination in this command, following the requirement to move unfinished work to another sprint.
8. Recheck membership and states after obtaining the write reservation. A concurrent agent update cannot leave unfinished work in a newly closed sprint.
9. Retain Done and Cancelled items in the closed sprint. Report their counts separately.

Ordinary item updates can move work to Backlog. A closed sprint cannot receive items, have item states changed in place, or have its lifecycle reversed. Moving an item out is allowed with item update permission; reopening requires the move and state change together. Descriptive item edits, links, comments, and attachments remain permitted.

### Blockers, readiness, cancellation, and automatic reopening

1. A valid Blocked by link refers to another visible item in the same project, in any sprint or Backlog, whose state is not Cancelled. Parent/Child/Related links do not satisfy the blocking requirement. Done targets are permitted; an item blocked only by Done targets immediately qualifies for the resume prompt.
2. Every entry into `blocked`, including item creation and REST/MCP updates, requires at least one Blocked by link at commit time. Existing links can satisfy this. Accept `blocked_by_item_ids` on create/update to add selected blockers and enter Blocked in one transaction; omitted means leave links unchanged. It is additive, not an implicit replacement/deletion of existing blockers. Link removal uses explicit unlink commands.
3. `blocker_summary` on item reads/cards includes total, Done, remaining-not-Done counts, `ready_to_resume`, and `blocker_revision`. Readiness is exactly `state == blocked AND total > 0 AND done == total`. The revision reflects the complete current dependency link set and blocker states/versions, not only the first page of links.
4. A ready item stays Blocked until the user explicitly selects **Move to In progress**. Show an indicator in Home/Planning/List/board and a dialog on each item-detail entry/re-entry/reload. **Not now** dismisses only the current visit; keep a persistent detail banner/action and ask again on the next visit. Do not persist a snooze or dismissal flag. If it becomes ready while already open, show the prompt once for that new readiness revision, not on every polling response. Read-only users see the same readiness information with a visible permission explanation instead of an enabled mutation action.
5. The resume action rechecks Blocked state, nonempty blockers, all Done, authorization and the supplied item/blocker revisions in the write transaction. If a blocker reopened or links changed, return a conflict and refresh; do not advance based on a stale prompt. A blocker becoming Done or reopening never automatically resumes the dependent; cancellation follows the explicit link-removal/Open rules below. A user may still explicitly choose another permitted state through the standard state controls.
6. Before cancelling a blocker, fetch a complete impact snapshot: all dependent items/links, item versions/states, and which Blocked dependents will have zero blockers after removal. Show: **“Cancelling PLAN-24 will remove it as a blocker for these items. Continue?”** List every affected item, with **Moves to Open** or **Remains Blocked** where applicable. Paginate display if needed but bind confirmation to the full set; do not silently confirm only the first page.
7. The cancellation command receives the source item version, `impact_revision` from that preview and `confirm_blocker_removal: true` when any dependent exists. In one transaction: revalidate the exact impact, set the source Cancelled, remove every incoming `blocked_by` link targeting it, move each affected still-Blocked item with zero remaining blockers to Open, increment affected versions, and record all events. Items with remaining links keep their states; if all remaining blockers are Done, they now qualify for the next-view resume prompt. Cancelled does not count as Done and never remains as a blocker. Reopening the cancelled source later does not restore removed links; they must be added explicitly.
8. Cancellation must use the dedicated command from every UI/REST/MCP surface. Generic PATCH attempts to set Cancelled return `409 cancellation_command_required` with the preview/command paths; they must not bypass impact confirmation. With no dependents, the command needs no blocker-removal acknowledgment and can use the ordinary cancellation action. Stale impact returns 409 and requires a refreshed confirmation. The acknowledgment is explicit mutation intent from the caller, not an additional out-of-band agent approval process.
9. **Last-link rule:** manually unlinking the last blocker, cancelling the last blocker, or deleting the last blocker automatically changes a surviving Blocked dependent to Open in the same transaction. No In-progress prompt applies because there are no remaining blockers. Show **“All blockers removed — moved to Open”** in success feedback and activity. This does not reopen a Done or Cancelled dependent, and it does not affect unrelated Parent/Child/Related links. Reject creation or updates that would otherwise leave a zero-link Blocked item persisted.
10. Deleting a blocker uses the existing deletion confirmation plus the affected-item/automatic-Open impact, with an expected impact revision just like cancellation. Unlinking shows a specific final-link warning before the action. Permission failures or conflicting versions roll back the entire compound operation. Do not delete dependent items.
11. Preserve removed-link identity and the reason (manual removal, blocker cancelled, blocker deleted) in authorized activity, along with every automatic Blocked -> Open transition. Add a migration/consistency check for this invariant before enabling the new workflow; no seed fixture may contain a Blocked item without blockers.

### Required item activity history

- Coverage includes creation/deletion; title and description edits; type, state, priority and assignee changes; labels added/removed/renamed when they affect the item; sprint/Backlog moves and manual ordering; all link additions/removals; comment creation/edit/deletion; attachment addition/removal; and automatic dependency effects. Changes made through bulk commands, REST, MCP and background application work are covered equally.
- Record dependency-specific events on every affected item: entering Blocked, blocker links changed, cancellation removing a blocker, explicit resume, and automatic Blocked -> Open after the final blocker is removed. Link changes appear in both linked items' histories, with the relationship direction made clear. Do not update only the item that initiated a multi-item action.
- Each entry includes a stable event ID, server timestamp, readable action, the actor's identity and Human/Agent/System kind, source interface, and changed fields with previous/new values where appropriate. Use explicit System attribution for automatic changes and retain the triggering event and initiating user/agent so the cause can be explained. Preserve attribution after a user is renamed or disabled.
- Group events from one operation using an operation/correlation ID. For example, cancelling a blocker records the source cancellation, each removed link and each dependent's automatic Open transition without hiding the individual effects. The UI can group them while keeping all events inspectable.
- History is durable and append-only. There are no user-facing edit/delete/clear-history endpoints or automatic history expiry in the initial version. Write the activity alongside each committed database mutation in the same transaction; if recording the event fails, roll back the mutation. A failed/rolled-back mutation must not appear as a successful change, and idempotent retries must not duplicate events. File lifecycle events are recorded with the corresponding committed metadata state.
- The history remains available after sprint closure and item movement. Retain prior history and a deletion tombstone after item deletion; authorized project activity can show it even when the normal item-detail route returns Not found. Preserve history in backups/restores. Do not cascade-delete it with item/comment/file records.
- Apply item/resource visibility to historical data just as to current data. Comment/file events cannot expose content or filenames without those view grants; removed-link events cannot reveal inaccessible targets. Never include credentials, session tokens or attachment bytes. Record description/comment edits as events without promising a version-restore feature or retaining deleted content contrary to the deletion policy.
- The Activity tab is a paginated timeline, newest first by default, with stable timestamp/event-ID ordering, actor and Agent/System labels, field changes, and a way to load older events until the complete authorized history is accessible. Include loading, first-event/empty, error/retry and permission-restricted states. Poll/refetch without discarding the user's position in older history.
- Scope clarification: this user-facing history tracks changes and meaningful lifecycle actions affecting the item. Routine reads, polling, attachment previews/downloads and failed requests do not populate the item timeline; operational/security request logging is separate. No other successful item mutation may silently bypass history.

### Permission checks

- Human admins have installation-wide access and manage users/project grants. Nonadmins, including all agents, require explicit project grants.
- Every resource operation requires `project:view` plus the relevant resource/action grant. Return 404 for resources the caller cannot view; return 403 for a visible resource with an insufficient action grant.
- Project metadata changes require `project:update`. User/permission administration, project creation, and project deletion require a human admin.
- Starting, closing, renaming, or reordering a sprint requires `sprint:update`. Closing with rollover additionally requires `item:update`; previewing unfinished items requires `item:view`.
- Moving/reordering/assigning/changing state or labels on items requires `item:update`. Selecting a destination sprint also requires `sprint:view`. Creating an item requires `item:create`; attaching it to a sprint also requires `sprint:view`.
- Link create/delete requires `item:update` and visibility of both endpoints. Parent and related links do not grant access or imply status changes.
- Dependency transition, cancellation/link cleanup and resume use the same project `item:update` grant. Deleting a blocker additionally requires `item:update` for its dependency side effects as well as the existing delete/dependent-resource grants. Missing rights reject the whole command; they must not leave a cancelled blocker linked or a zero-link Blocked dependent. Impact previews follow item view permissions and never reveal another project's work.
- Label management follows `item:create` for creating a reusable label, `item:update` for renaming, and `item:delete` for deletion; assigning existing labels follows item create/update as appropriate.
- Comment/file operations require `item:view` plus their own resource/action grant. Comment authorship does not bypass a missing grant. Keep original author and last editor identity.
- Item deletion requires `item:delete`; if it has comments or attachments, also require the corresponding delete grants. Remove links, label joins, and children’s parent associations without deleting the linked items. Emit deletion events.
- Nonadmins can only read an activity event if they meet the normal view checks for its resource type, including parent-item visibility for comment/file events. Permission/account administration events are admin-only. Do not leak filenames, comment text, summaries, or aggregates through a different endpoint.
- Users can read their own preferences and identity. Project assignee lookup returns minimal eligible user details, not a global user directory.
- Reject assignments to users without project item visibility. Removing visibility or disabling a user leaves historical assignments visible as inactive/inaccessible assignees until reassigned; it does not erase authorship.
- Recheck grants for every REST request and MCP tool call, including existing MCP connections. Do not cache authorization for the lifetime of a connection.
- The UI hides/disables unavailable controls using effective grants returned by the server; the backend is authoritative.

## 7. Authentication, setup, and local access

### First startup and human login

- The empty installation serves a setup screen instead of the application/login screen. `GET /setup` reports only whether setup is required.
- `POST /setup` accepts the chosen username/password and atomically creates the first human admin and marks setup complete. Competing requests cannot create multiple initial admins. Once initialized, reject subsequent setup attempts.
- Before initialization, only setup, health, and required static assets are available; project routes and MCP tools are unavailable.
- Hash human and agent passwords using Argon2id through a maintained password library. Never store/retrieve a plaintext password or include credentials in activity logs.
- Use opaque revocable browser sessions in HttpOnly, SameSite cookies. Apply same-origin/CSRF protection to cookie-authenticated mutations, login, and setup. Use Secure cookies when HTTPS is configured; local HTTP development is explicitly supported.
- Proposed defaults: 12-hour browser sessions; no public registration, email confirmation, or email password recovery. Provide an offline administrator recovery command in operations documentation.
- Administrators create users, reset human passwords, rotate agent passwords, enable/disable users, and manage grants. Preserve at least one enabled human admin. Password changes and disabling revoke outstanding sessions/tokens.

### Agent credentials and API tokens

- Creating an agent generates a username such as `agent-calm-otter-a31f` with a uniqueness check/retry and an independent random UUIDv4 password.
- Show the generated UUID password once in the authenticated creation response and credential dialog. Rotation creates and displays a new UUID password once, revoking prior sessions/tokens. Public user responses never contain the password/hash.
- Human usernames are chosen by the administrator; agent usernames are generated and stable in v1. Display name can be edited.
- Agents exchange username + UUID password at `POST /auth/token` for a random opaque API token (proposed expiry: 24 hours, with explicit revocation). REST and the local MCP endpoint accept that token in `Authorization: Bearer ...`.
- This token exchange is the application's local authentication scheme, not a claim to implement OAuth. The first MCP client must support configured authorization headers. OAuth-only clients and remote MCP access are deferred; document this compatibility limit. MCP's standardized HTTP authorization is OAuth-based, as described in the [MCP authorization specification](https://modelcontextprotocol.io/specification/latest/basic/authorization).
- Keep client secrets/tokens in local environment or secret configuration. Do not put them in URLs, browser localStorage, committed configuration, or logs. Never expose a tool that creates users, changes grants, or reveals credentials.

### Local network boundary

- Native development listens on loopback. Inside Docker, Uvicorn listens on the container interface, with Compose publishing `127.0.0.1:8080:8080` on the host.
- Local sibling agent containers can use a private Docker network and service DNS; do not publish the service publicly to accommodate them. Test host-browser, host-agent, and sibling-container connectivity independently.
- Configure explicit allowed hosts and origins, including the chosen local service name where needed. Same-origin production UI needs no permissive CORS. Vite proxies development API calls to FastAPI.
- Validate MCP Origin headers when present and require credentials on every MCP request. The [Streamable HTTP transport specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx) calls for Origin validation and localhost binding for local servers.
- Remote hosting, tunnels, public discovery, TLS termination infrastructure, and OAuth authorization-server integration are outside this implementation.

## 8. REST API inventory

All paths below are under `/api/v1` unless stated otherwise. All authenticated endpoints apply the checks in section 6. OpenAPI must document each request, response, permission, and error.

### Common conventions

- JSON uses `snake_case`; public enum values match the schema. UUID IDs are opaque and readable item keys are additional fields.
- Create: 201 with resource and Location. Read/update/action: 200. Delete/logout: 204 except dependency-aware item/link deletion, which returns 200 with side effects. Collections return `{items,total,offset,limit}`; default limit 50, maximum 200, with deterministic ordering.
- Validation: 422. Unauthenticated: 401. Insufficient visible-resource permission: 403. Missing/invisible: 404. Domain conflict: 409. Stale version: 412. Missing required precondition: 428. Busy database: 503 with retry guidance. Oversize attachment: 413.
- Use a consistent error body `{code,message,details,request_id}`. Details must not reveal inaccessible resources or secrets.
- Mutable resources return `version` and an ETag. Updates/deletes require `If-Match`; multi-entity commands carry expected versions in their body. Permission-matrix replacement uses a per-project grant revision. Creation does not require a precondition.
- POST creates and compound commands support an `Idempotency-Key` scoped to the caller and canonical request hash. Reusing a key with different input returns 409. Do not retain secret-bearing auth/setup/user-credential responses in the idempotency store.
- PATCH is a partial object: omitted means unchanged; explicit null clears a nullable field. Replacing labels uses the complete `label_ids` array. Unknown fields are rejected.

### Setup, authentication, preferences, and metadata

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/setup` | Public `{setup_required}` |
| POST | `/setup` | Initial `{username,password}`; returns first admin and browser session |
| POST | `/auth/login` | Human username/password; session cookie and current user |
| POST | `/auth/logout` | Revoke current browser session and clear cookie |
| POST | `/auth/token` | Username/password; returns opaque API token, type, expiry |
| DELETE | `/auth/token` | Revoke the presented bearer token |
| GET | `/auth/me` | Current public user identity and admin flag |
| PUT | `/auth/password` | Human user's current/new password; revokes sessions and requires login again |
| GET | `/me/preferences` | Appearance and accent, defaults when unset |
| PATCH | `/me/preferences` | Set validated appearance/accent values |
| GET | `/metadata` | Item types/states/priorities, link relationships including blocked_by/blocks, allowed modes, available accents, configured file limits |

### User administration

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/users` | Admin-only paginated user directory; filter kind/enabled |
| POST | `/users` | Admin-only human `{kind,username,display_name,password,is_admin}` or agent `{kind,display_name?}`; agent response includes generated username and one-time UUID password |
| GET | `/users/{user_id}` | Admin-only public account details |
| PATCH | `/users/{user_id}` | Admin-only display name, human admin flag, enabled; enforce last-admin protection |
| POST | `/users/{user_id}/reset-password` | Admin-only human password reset; never returns the prior password |
| POST | `/users/{user_id}/rotate-agent-password` | Admin-only agent UUID password rotation; one-time returned credential |

Users are disabled, not deleted. Password mutation endpoints require the target user's current version. Generated credentials have explicit `Cache-Control: no-store` and log redaction.

### Projects, permissions, and overview

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/projects` | Visible project summaries; counts only for resource types caller can view |
| POST | `/projects` | Admin-only `{key,name,description?}`; grant creator full access atomically |
| GET | `/projects/{project_id}` | Description and effective caller permissions |
| PATCH | `/projects/{project_id}` | Update name/description; key stays immutable |
| DELETE | `/projects/{project_id}` | Admin-only, empty project only |
| GET | `/projects/{project_id}/permissions` | Admin-only permission matrix and grant revision |
| PUT | `/projects/{project_id}/permissions/{user_id}` | Admin-only replace that user's explicit resource CRUD matrix using expected grant revision |
| DELETE | `/projects/{project_id}/permissions/{user_id}` | Admin-only revoke explicit grants with expected revision; admin override remains |
| GET | `/projects/{project_id}/assignees` | Minimal enabled, item-visible assignee candidates |
| GET | `/home` | Visible projects, one active sprint per project, state counts, blocked and assigned work; counts and lists obey resource visibility |
| GET | `/projects/{project_id}/activity` | Paginated authorized activity, optionally filtered by item |

No project access is implicit merely because a user or agent exists.

### Sprints and planning

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/projects/{project_id}/sprints` | Ordered sprints; optional lifecycle filter |
| POST | `/projects/{project_id}/sprints` | `{name}` -> planned sprint |
| PUT | `/projects/{project_id}/sprint-order` | Full ordered sprint ID list and expected sprint versions |
| GET | `/projects/{project_id}/planning` | Paginated Backlog and ordered sprint summaries; fetch sprint items using the shared item query |
| GET | `/sprints/{sprint_id}` | Sprint details, authorized state counts, version |
| PATCH | `/sprints/{sprint_id}` | Rename sprint; lifecycle fields are command-controlled |
| DELETE | `/sprints/{sprint_id}` | Delete only an empty planned sprint |
| POST | `/sprints/{sprint_id}/start` | Expected version; enforce one active sprint per project |
| GET | `/sprints/{sprint_id}/close-preview` | Done/Cancelled counts, unfinished item IDs, eligible destinations; paginated unfinished list |
| POST | `/sprints/{sprint_id}/close` | Expected sprint version, optional rollover destination/version; validate and close atomically |
| GET | `/sprints/{sprint_id}/board` | Counts for all five states plus independently paginated item cards per state |

There is no stop/pause endpoint. Active and closed lifecycle states cannot be assigned through generic PATCH.

### Items, filters, ordering, and links

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/items` | Cross-project authorized item query; shared by List and MCP |
| POST | `/projects/{project_id}/items` | Required title/type; optional description/state/priority/assignee/sprint/labels and additive `blocked_by_item_ids`; Blocked requires at least one valid blocker |
| POST | `/projects/{project_id}/items/bulk-move` | Selected item IDs/versions and nullable destination sprint; all-or-nothing, same project, preserve states |
| PUT | `/projects/{project_id}/item-order` | Scope (`sprint_id` nullable), full ordered item ID list and expected item versions; no membership changes |
| GET | `/items/{item_id}` | Core fields, readable key, public assignee, labels, effective permissions, version and `blocker_summary`; comments/files fetched separately |
| PATCH | `/items/{item_id}` | Core edits and additive `blocked_by_item_ids`; Blocked requires blockers; Cancelled uses the dedicated cancellation command |
| GET | `/items/{item_id}/deletion-preview` | Existing deletion checks plus complete blocker/dependent impact and `impact_revision` |
| DELETE | `/items/{item_id}` | Existing delete checks plus expected dependency impact revision; remove incoming blocker links and atomically move zero-link Blocked dependents to Open |
| GET | `/items/{item_id}/links` | Parent/children/related plus Blocked by and inverse Blocks links; include complete summary separately from pagination |
| POST | `/items/{item_id}/links` | `{relationship,target_item_id,expected_target_version}`; relationships: parent, child, related, blocked_by, blocks; normalize direction and reject invalid/cyclic dependencies |
| DELETE | `/items/{item_id}/links/{link_id}` | Link and affected-item preconditions; final-blocker removal atomically returns a Blocked dependent to Open; response describes removed link and automatic state changes |
| GET | `/items/{item_id}/cancellation-preview` | Complete dependent/blocker impact, resulting Open transitions, source version, and `impact_revision` |
| POST | `/items/{item_id}/cancel` | Source version, expected impact revision, explicit removal acknowledgment when needed; cancel/remove/reopen atomically; return all state-change effects |
| POST | `/items/{item_id}/resume` | Expected item version and blocker revision; revalidate readiness then explicitly set In progress |
| GET | `/items/{item_id}/activity` | Complete authorized item history, paginated with stable `(created_at,id)` ordering; entries include actor/kind/source, action, changed-field data and operation/cause references; newest first by default |
| GET | `/projects/{project_id}/labels` | Label list/search |
| POST | `/projects/{project_id}/labels` | Create uniquely named project label |
| PATCH | `/projects/{project_id}/labels/{label_id}` | Rename label with precondition |
| DELETE | `/projects/{project_id}/labels/{label_id}` | Remove label and its joins, leaving items intact |

Labels and links carry their own versions. Creation/removal of links also increments affected item versions. Label replacement/removal increments versions of affected items so stale edits cannot silently restore deleted associations.

Dependency-aware item deletion returns 200 `{deleted_item_id,removed_blocker_links,automatic_state_changes}`; unlink returns 200 `{removed_link_id,automatic_state_changes}` rather than the usual 204 so clients can show the required Open feedback. Cancel/delete/resume preconditions cover every affected item and the full dependency graph slice; an `impact_revision` is a server-computed snapshot fingerprint, not merely a caller-supplied list or a display-page checksum. Validate it after acquiring the write reservation. Cancel/resume commands support idempotency keys and report actual effects, not a proposed future state.

Home, Planning, item query and board card results include authorized `blocker_summary`. Queries also support `blocked_by_item_id`, `blocks_item_id` and `ready_to_resume=true`. These filters are shared by REST and MCP.

`GET /items` supports repeated `project_id`, `sprint_id`, `type`, `state`, `assignee_id`, `label_id`, `priority`, plus `backlog=true`, `unassigned=true`, text `q`, `updated_since`, `sort`, `direction`, `offset`, and `limit`. OR values within one field; AND different fields, except that all selected labels must match. Multiple sprint IDs and Backlog form a union; selected assignees and Unassigned also form a union. Sort fields are allowlisted (`key`, `title`, `priority`, `state`, `created_at`, `updated_at`, `rank`) with ID tie-breaks. Key sort uses project key and numeric item number; priorities/states use defined semantic order. Rank sort is available only for a single project and a single sprint/Backlog scope.

Start with parameterized title/description/key substring search, escaping SQL wildcard literals. No raw SQL, arbitrary expressions, or JQL interpreter. A visual filter builder creates the same validated query string used by REST/MCP. The planning/board endpoints must paginate actual cards; never silently truncate a sprint or treat the first page as the complete set.

### Comments and attachments

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/items/{item_id}/comments` | Paginated chronological comments with author/editor identity |
| POST | `/items/{item_id}/comments` | `{body}` -> comment |
| PATCH | `/items/{item_id}/comments/{comment_id}` | Edit body using comment version |
| DELETE | `/items/{item_id}/comments/{comment_id}` | Delete using comment version |
| GET | `/items/{item_id}/attachments` | Paginated attachment metadata and preview availability |
| POST | `/items/{item_id}/attachments` | Multipart file upload; streamed size enforcement |
| GET | `/attachments/{attachment_id}` | Authorized metadata and available preview kind |
| GET | `/attachments/{attachment_id}/content` | Authorized original-file download with safe content disposition |
| GET | `/attachments/{attachment_id}/preview` | Authorized safe image representation or bounded text-preview JSON |
| DELETE | `/attachments/{attachment_id}` | Remove metadata/access and schedule durable file cleanup |

Validate that nested comment/link/attachment IDs belong to the requested item; a permitted parent ID must not bypass child-resource authorization.

### Operational endpoints

- `GET /health/live`: public minimal process health, no environment or data details.
- `GET /health/ready`: public minimal readiness; migrations complete and database/storage usable. Setup-required is a valid running state, not a restart loop.
- `/api/v1/openapi.json` and `/api/v1/docs`: local API schema/docs, authenticated after setup; verify browser documentation can use the session. Health and docs are not SPA fallback routes.
- `/mcp`: MCP transport endpoint, outside the REST prefix. Supported transport methods and version negotiation come from the pinned SDK/client compatibility target.

## 9. Attachment storage and previews

- Put file bytes in `/data/attachments`, with metadata in SQLite. Never expose the volume through a public static mount.
- Generate internal storage keys; original filenames are display-only. Reject traversal paths, normalize display filenames, and stream uploads into a temporary location on the same volume.
- Inspect actual file content for preview eligibility rather than trusting the filename or upload Content-Type. Enforce byte and decoded-image dimension limits.
- Initial image previews: PNG, JPEG, GIF, WebP, BMP; TIFF/HEIC/AVIF can be downloaded and are previewed only if explicitly supported by the selected decoder. Produce a bounded safe raster preview when the source is unsuitable for direct display. Document the actual matrix.
- Initial text previews: UTF-8 text, Markdown, JSON, YAML, CSV, logs, and common source-code files. Render as escaped text with optional safe syntax highlighting. Return truncation/encoding metadata; unsupported encodings or binary files fall back to download.
- HTML and SVG are not rendered as active documents. Raw Markdown HTML is disabled; sanitize rendered output and safe-link protocols. PDF, office-document rendering, and video/audio playback are deferred.
- Require normal authorization for both previews and downloads. Use `nosniff`, safe filenames, bounded previews, and no filesystem path leakage.
- The filesystem and SQLite are not one atomic store: stage uploads, commit a pending metadata record, atomically finalize the file, then mark ready. A recoverable storage state handles crashes between steps; list/download expose only ready files.
- Deletion first revokes metadata visibility, then removes bytes through a durable cleanup record/state. A startup/periodic reconciliation pass completes pending writes/deletes and removes aged orphaned temp files. It must not delete referenced ready files.
- Store checksums, original sizes, and preview metadata. Keep attachment content out of audit JSON and ordinary logs.

## 10. MCP interface

Mount the official SDK's Streamable HTTP application at exactly `/mcp`, avoiding accidental `/mcp/mcp` routing. Start/stop its required transport manager through the parent FastAPI lifespan. Mounted sub-application lifespans need explicit integration; see the [official SDK ASGI integration documentation](https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/run/asgi.md).

### Tools

| Area | Tools |
| --- | --- |
| Discovery | `who_am_i`, `get_metadata`, `list_projects`, `get_project`, `get_home` |
| Project details | `update_project`, `list_assignees`, `list_activity` |
| Sprints | `list_sprints`, `get_sprint`, `get_planning`, `get_sprint_board`, `create_sprint`, `update_sprint`, `reorder_sprints`, `delete_sprint`, `start_sprint`, `preview_sprint_close`, `close_sprint` |
| Items | `query_items`, `get_item`, `create_item`, `update_item`, `preview_item_deletion`, `delete_item`, `move_items`, `reorder_items`, `preview_item_cancellation`, `cancel_item`, `resume_item` |
| Links and labels | `list_item_links`, `link_items`, `unlink_items`, `list_labels`, `create_label`, `update_label`, `delete_label` |
| Comments | `list_comments`, `create_comment`, `update_comment`, `delete_comment` |
| Attachments | `list_attachments`, `get_attachment`, `read_attachment_text`, `attach_file`, `delete_attachment` |

- Use typed JSON schemas, bounded pagination, explicit IDs, and structured results/errors. Return versions with reads and require expected versions for mutations just as REST does.
- Tool capabilities are filtered to effective grants where useful, but every call still enforces its own permissions. A discovered tool is never proof of authorization.
- Annotate read-only, destructive, and idempotent behavior accurately. Annotations do not replace permission checks or make an operation safe to repeat.
- `attach_file` accepts a filename and bounded base64 content for small files only (proposed 1 MiB decoded limit); larger files use authenticated REST multipart upload. Do not accept arbitrary server file paths or fetch arbitrary URLs.
- `read_attachment_text` provides the same bounded safe text preview as REST. Image/binary metadata includes REST download/preview paths that still require authentication; do not create unauthenticated bearer URLs or return huge binary payloads in tool results.
- Agent identity is resolved from authentication, never from an `actor_id` argument. Record the actual actor and interface for every mutation.
- `list_activity` supports item-scoped pagination over the same complete authorized history as REST, including human, agent and automatic actions; never limit an agent's view to events it created.
- MCP exposes Blocked by/Blocks and the same block-entry, last-link -> Open, cancellation impact acknowledgment and stale-readiness checks as REST. Item reads include readiness on every call; agents can explicitly call `resume_item`. No automatic agent-side state change is inferred merely because a read returned ready.
- Support idempotency keys on applicable tools. Redact secrets in errors and do not offer arbitrary command execution, SQL, file browsing, or account/permission administration tools.
- Include a tested local client setup example: create agent, grant project permissions, exchange credentials for a token, configure `/mcp` with the authorization header, query assigned work, update an item, and add a comment.
- Test the actual supported client through the full MCP handshake/discovery/tool call flow, not only direct Python function calls. Record the selected SDK/protocol/client versions in agent setup documentation.

## 11. React client

Design reference: [complete screen inventory](../../design/README.md), [shared design guide](../../design/design_guide.md), and [interactive screen previews](../../design/index.html). Each screen has its own design folder and review record. The user approved these design baselines for implementation on November 9, 2026; the confirmed domain and permission requirements in this plan remain authoritative.

Use React Router for routes, TanStack Query for server-state caching/refetching, generated OpenAPI TypeScript types, and a small fetch wrapper for cookies, CSRF, errors, and preconditions. Keep ephemeral UI state in React. No additional global state framework is needed initially. See [React Router](https://reactrouter.com/start/declarative/installation) and [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview).

### Navigation and screens

| Screen | Main behavior |
| --- | --- |
| Setup `/setup` | Choose initial admin username/password, validation, then enter app |
| Login `/login` | Human login, clear inline errors, session expiry handling |
| Home `/` | All visible projects, each active sprint, assigned/blocked work and separate Done/Cancelled counts |
| Project `/projects/:id` | Project description, summaries, project editing, links into Planning/List/Sprint |
| Planning `/projects/:id/planning` | Backlog and ordered sprint sections, sprint create/rename/reorder/start/close, item multi-select and moves |
| List `/items` | Visual query builder, filters/sort in URL, paginated table, selectable columns for standard fields |
| Sprint `/projects/:id/sprints/:sprintId` | Five state columns; cards show key, title, type, priority, assignee, labels, link indicators; sprint selector and current-sprint shortcut |
| Item `/projects/:id/items/:itemId` | Full editor, state/sprint/assignee/labels/priority controls, links, comments, attachments/previews, permitted activity |
| Users `/admin/users` | Create human/agent, enable/disable, reset/rotate credentials, agent badge and one-time credential display |
| Permissions `/projects/:id/settings/permissions` | Admin-only per-user/resource CRUD matrix; clear effective rights and no-access defaults |
| Appearance `/settings/appearance` | Mode selector and named accent swatches with live preview |
| Account `/settings/account` | Current human identity, change-password dialog, and sign out |

- Left navigation: Home, project selector, Planning, List, Sprint; settings/account access near the bottom. Header: current page/project, contextual create button, appearance shortcut, signed-in identity.
- Current sprint is project-scoped. If none exists, show a clear empty state and a Planning shortcut; Home can show multiple projects' current sprints.
- State columns provide the requested swim-lane view. Optional row grouping by assignee/parent is deferred.
- Blocked card/detail/list indicators show blocker count and **Ready to resume** when all remaining blockers are Done. Requesting Blocked from any card/menu/form opens a multi-blocker selection dialog if needed; persist links and state together. Show Blocked by and inverse Blocks groups on item detail.
- Each ready Blocked item detail visit opens **All blockers are Done — move to In progress?** with **Not now** and **Move to In progress**. Keep a banner after Not now; repeat next visit. If the final link is removed, show Open and automatic-transition feedback instead, with no resume prompt.
- Cancelling a blocker from any surface opens the impact confirmation; names, resulting automatic Open transitions and remaining blockers are explicit. Delete/unlink confirmations use the same impact language where relevant.
- Dragging a card changes its state. Planning drag/drop changes sprint membership/order. All gestures also have keyboard and menu-based equivalents.
- Persist moves through API commands; optimistic updates must roll back on errors. On a version conflict, explain that the item changed and refetch; never overwrite blindly.
- Close-sprint dialog shows Done, Cancelled, and unfinished counts. Let the user choose another sprint for all unfinished work or cancel the action. A server conflict refreshes the preview.
- Do not infer a complete board from a paginated response. Provide load-more controls per column and accurate totals.
- Invalidate/refetch affected Home, Planning, List, board, detail, and history caches after mutations. Poll only visible working views; refetch on focus so agent changes appear without page reloads.
- Item Activity is a required full historical timeline, separate from Comments. Show human/agent/system attribution, timestamp, field changes and grouped operation causes; Load older must make the complete authorized history reachable. History remains available on closed-sprint work, and automatic dependency transitions explain why they happened.
- Include loading, empty, error, forbidden, deleted, and expired-session states. Require confirmation for destructive operations and closing a sprint. Do not copy this UI confirmation requirement into an unnecessary extra agent approval workflow.
- Render Markdown safely. File and comment permissions control both controls and loaded data. Credential dialogs have a copy button and explain that the password cannot be retrieved later.

## 12. Light, dark, and color themes

- Modes: **Light**, **Dark**, **System**. System follows the operating system, including changes while the app is open.
- Accent choices: **Blue** (default), **Indigo**, **Purple**, **Pink**, **Red**, **Orange**, **Amber**, **Green**, **Teal**, **Slate**.
- Persist authenticated preferences per user in SQLite through `/me/preferences`. Cache only nonsecret appearance preferences locally to apply before React paints. Key authenticated caches by user and clear/switch them on logout or account changes.
- Setup/login use System + Blue by default and may use a device-local mode/accent selection before authentication. Server preferences take precedence after login.
- Define CSS custom properties for backgrounds, surfaces, borders, foregrounds, muted text, accents, controls, focus rings, and semantic status colors. Provide paired light/dark tokens for every accent.
- Use the accent for actions, selection, and focus. Keep semantic meanings for errors, blocked work, Done, and Cancelled stable; text/icons must identify states independently of color.
- Theme dialogs, menus, tables, drag states, comments, code/text previews, empty states, and image preview surrounds. Use `color-scheme` for native controls and avoid a bright flash during dark-mode startup.
- Meet text contrast of 4.5:1 for normal text and 3:1 for large text, and meaningful control/focus boundaries of 3:1. See W3C guidance for [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Verify every accent in both modes, keyboard focus, selected and disabled states, system preference changes, persistence, and separate users with different settings.

## 13. Dockerfile, local operation, and backups

### Generate and validate the Dockerfile during implementation

- Create a multi-stage `Dockerfile`: a Node build stage installs frontend dependencies using the lockfile and runs the production build; a Python dependency stage installs locked runtime dependencies; a slim Python final stage copies the backend, migrations, runtime dependencies, and compiled static frontend.
- The final image contains no Node server or frontend development server. Run one Uvicorn worker as a nonroot user. Handle container termination cleanly.
- Include writable `/data` storage, a health check, and an entrypoint that runs migrations before serving requests. Migration errors must stop startup. Do not bake data or credentials into the image.
- Create `.dockerignore` excluding secrets, SQLite files and sidecars, attachments, local environments, node_modules, caches, and repository metadata.
- Create `compose.yaml` with one app service, host publication `127.0.0.1:8080:8080`, a persistent volume mounted at `/data`, a restart policy, and optional documented private-network connectivity for local agent containers.
- Build and test the actual image. Verify first-admin setup, login, REST, MCP, attachments, deep-link reloads, themes, and persistence after container replacement.

### Configuration and operations

- Configure data directory, port, allowed hosts/origins, session/token lifetime, file limits, and log level through environment settings with safe local defaults. Document only configuration actually implemented.
- Development uses Vite and FastAPI reload separately, with a development proxy. Production uses the single container.
- Store `/data/app.db`, attachment files, and recoverable storage cleanup state durably. Do not treat container replacement as a database reset.
- Document a consistent backup/restore procedure covering both SQLite and attachments. Initial default: stop the app cleanly, copy the entire data volume, restart, and verify the backup. A future online backup must coordinate file state with a SQLite backup snapshot; copying only a live `.db` file is insufficient.
- Restore only while the app is stopped; verify schema compatibility and perform a full recovery smoke test including attachments. Back up before migrations.
- Log request IDs, errors, and actor IDs where useful; redact passwords, authorization headers, session cookies, and file/comment bodies. Activity history remains the user-facing record of mutations.
- Provide an offline admin recovery command with physical/local data-volume access, and document that it revokes old credentials/sessions.

## 14. Implementation sequence and acceptance gates

### Phase 1: Foundation and contracts

- [x] Scaffold the backend/frontend directories, dependency lockfiles, formatting/linting/type-checking, application configuration, and test entry points.
- [x] Define enums, REST schemas/errors, permission semantics, service boundaries, and generated frontend API types.
- [x] Add database connection configuration, Alembic, initial tables/constraints/indexes, and temporary-file SQLite integration fixtures.
- [x] Add health endpoints and route ordering/static fallback.
- Gate: fresh database migrates successfully; invalid enums/cross-project references and duplicate active sprints are rejected; API errors do not return frontend HTML.

### Phase 2: Setup, identity, and permissions

- [x] Implement initial-admin setup, password hashing, browser sessions/CSRF, bearer token exchange/revocation, current user, and offline recovery.
- [x] Implement human/agent administration, generated agent names/UUID passwords, rotation, disabling, and last-admin protection.
- [x] Implement project CRUD limits, grant matrices, effective permission responses, assignee lookup, and shared authorization.
- [x] Add setup/login, user administration, and project permissions screens.
- Gate: setup runs exactly once under concurrent attempts; two identities with different grants cannot bypass access through IDs, aggregates, child routes, or another interface; generated credentials are returned once and never stored as plaintext.

### Phase 3: Core work management

- [x] Implement sprint creation/order/start/close/preview and item CRUD, ordering, movement, states, labels, assignment, numbering, and query filters.
- [x] Implement parent/child/related and directed Blocked by/Blocks links, single-parent enforcement, canonical related links, and separate hierarchy/dependency cycle prevention.
- [x] Implement atomic blocked-entry validation, derived readiness/revisions, explicit resume, cancellation/deletion impact previews and acknowledgments, and last-link removal -> Open across REST and MCP.
- [x] Add optimistic concurrency, idempotency for supported writes, and complete transactional, append-only item activity history across every mutation path, affected item and source interface.
- Gate: each project has at most one active sprint; Done/Cancelled permit closure; unfinished work prevents closure or moves atomically without state reset; concurrent updates cannot violate these rules; item keys remain unique and stable.

### Phase 4: Comments and files

- [x] Implement comment CRUD and activity, attachment ingestion/storage states/download/delete/reconciliation, and safe image/text previews.
- [x] Enforce file limits, authorization, MIME inspection, Markdown sanitization, and crash recovery.
- Gate: previews/downloads require permission; traversal and active markup cannot execute; a failed/interrupted upload or delete recovers without broken ready-file references.

### Phase 5: Main React experience and themes

- [x] Review and apply the shared design guide and per-screen specifications under `docs/design`; record screen decisions before treating layouts as approved.
- [x] Build the application shell, Home, project details, Planning, List query builder, Sprint board, and Item detail.
- [x] Add accessible drag/drop equivalents, mutation/conflict handling, complete pagination, agent-change polling, and permission-aware controls.
- [x] Add block-item, blockers-resolved and cancel-blocker designs; repeat the ready prompt on each detail visit, and show automatic Open feedback after the final dependency is removed.
- [x] Implement the required paginated item Activity timeline, including all change categories, actor/kind/source, old/new field values where appropriate, operation grouping, cause attribution and complete older-history navigation.
- [x] Implement Light/Dark/System, all ten accents, per-user settings, and initial theme application.
- Gate: a human can create a project/sprint/item, plan and update work, comment/attach/preview, and close a sprint; a second user sees only permitted data; theme changes persist and meet contrast targets.

### Phase 6: Agent MCP integration

- [x] Implement transport mounting/lifecycle/authentication and the tool inventory over the same services.
- [x] Add tool schemas, structured results/errors, versions, bounds, and idempotency.
- [x] Document and test a real local MCP client connection and example agent workflow.
- Gate: REST and MCP produce the same domain behavior and enforce the same grants; expired/revoked credentials fail; changing permissions takes effect on an already connected agent's next call; UI sees agent updates.

### Phase 7: Docker packaging and release verification

- [x] Generate the multi-stage Dockerfile, `.dockerignore`, and Compose file.
- [x] Build the production image and verify loopback publication, local container-agent connectivity, nonroot storage access, migrations, and graceful shutdown.
- [x] Verify data survives container removal/recreation, and rehearse complete backup/restore with attachments.
- [x] Complete README, REST/OpenAPI usage, local agent setup, supported preview matrix, recovery, and operational instructions.
- Gate: one documented local startup command launches the full app, presents setup on a fresh volume, preserves existing data on subsequent starts, and exposes working UI/REST/MCP through one service.

## 15. Verification plan

Use focused tests for domain/authorization risks and a small number of end-to-end journeys; avoid duplicating implementation details in brittle tests.

- Backend: pytest, API tests, and real temporary SQLite databases for foreign keys, migrations, concurrent writes, WAL behavior, sprint/parent constraints, and rollback. Use distinct sessions for race tests rather than an in-memory single-connection shortcut.
- Permissions: parameterized resource/action checks for human/agent parity, denied direct-ID access, dependent-resource deletion, hidden aggregates, assignment eligibility, and grant revocation during an existing MCP connection.
- Lifecycle races: concurrent sprint starts, item state/membership change versus closure, parent-cycle creation, and setup submissions. Verify failed rollover leaves every item and sprint unchanged.
- Blockers: reject Blocked without a dependency through every create/update/drag/MCP path; support multiple blockers and cross-sprint same-project links; reject cancelled targets, self-links, duplicates and dependency cycles. Verify ready only when the nonempty complete blocker set is Done, not when only a displayed page is Done. Not now never suppresses the next-view prompt; polling does not repeatedly reopen a dismissed prompt within one unchanged visit.
- Dependency side effects: cancellation preview lists all impacted items; cancel/remove/automatic Open happen atomically, with correct activity and affected versions. Removing the final blocker manually, by cancellation or by deletion moves only Blocked dependents to Open; removing one of several preserves state and recomputes readiness. Never auto-resume to In progress. Reopening a Done blocker invalidates a pending resume; concurrent link additions invalidate a cancellation/deletion preview. Permission failures, stale impact and competing last-link removals must roll back safely and cannot leave an unconfirmed dependency removal or zero-link Blocked record.
- Activity coverage: verify every item mutation category through UI-backed REST and MCP services, including bulk operations, both ends of link changes, comments/files and each automatic dependency side effect. Confirm actor/cause attribution, before/after field data, transactional rollback if history writing fails, no duplicate events on idempotent retries, permission redaction, stable pagination through tied timestamps, and complete retention after moves, sprint closure, user changes, deletion tombstones and backup/restore. Verify Activity is separate from Comments and older events remain reachable.
- Authentication: one-time generated credentials, hashing, expired/revoked tokens, session logout, CSRF/origin handling, last-admin rules, redaction, and password rotation.
- Files: allowed images/text, malformed/oversize input, unsupported binary fallback, Unicode filenames, traversal, executable markup, partial uploads, and reconciliation after simulated interruption.
- Frontend: type checking, linting, targeted component tests for filters/conflicts/theme persistence, and browser journeys for setup, permissions, planning, board changes, item detail, files, and sprint closure.
- Appearance: review all 20 accent/mode combinations for contrast and key interactive states; test System changes and initial paint. Use screenshot checks only where they add meaningful layout verification.
- MCP: real initialization, discovery, read/write/delete permissions, pagination, stale versions, structured domain errors, and authenticated attachment text access against the packaged server.
- Container: fresh-volume startup, restart without setup reset, no Node runtime requirement, production SPA deep links, host-loopback binding, private local agent access, durable attachments, and backup/restore.

## 16. Deferred scope and remaining decisions

No unanswered product question blocks the initial implementation plan. The user confirmed the sprint closure exception for Cancelled, local-only access, and proposed permission defaults after clarification.

The implementation defaults in section 3 remain easy to revise before their phases begin. In particular, permanent deletion versus a future trash/archive system, individual priority labels, and exact attachment limits were not separately selected by the user.

Deferred: remote/cloud-agent access, OAuth-only MCP clients, configurable workflows, sprint pause/reopen, scheduled dates, multiple parents, cross-project links, custom fields, time tracking/estimates, epics beyond parent links, notifications/email, persisted saved queries, real-time push updates, document/media preview engines, and project templates.

Integration selection: official Python MCP SDK 1.30.0, with real Streamable HTTP handshake, discovery, tool execution, authorization and container-network checks. See [agent setup](../../agent-setup.md).
