# Initial implementation and verification

Delivered November 9, 2026 against the approved [implementation plan](todo/pending/initial_implementation.md) and [35-screen design baseline](design/README.md).

## Delivered

- React/TypeScript client: setup/sign-in, Home, project overview, Planning, URL-based item queries, sprint board, item details, comments, attachments, Activity, users, project grants, account and appearance settings. Forms and confirmations implement the corresponding approved dialog/panel designs.
- FastAPI REST backend and generated OpenAPI/TypeScript contracts; SQLAlchemy 2.x, SQLite WAL, frozen Alembic initial migration and bounded serialized writes.
- Shared REST/MCP authorization, optimistic versions, revision-checked impact confirmations, idempotency with permission rechecks, human sessions/CSRF and agent bearer authentication.
- Sprint ordering and one-active-sprint enforcement; atomic closure/rollover; backlog and item ordering; assignment, labels and priority; parent/child, related and directed blocker relationships.
- Required dependency rules: Blocked requires links; all-Done readiness asks each detail visit; explicit resume revalidates; cancelling a blocker confirms its affected items; removing the final blocker automatically moves a surviving Blocked item to Open.
- Durable, append-only item history with actor/source/cause and operation attribution, link endpoint snapshots, deletion tombstones and stable cursor pagination.
- Bounded text and reencoded image previews, upload progress/cancel/idempotent retry, durable file reconciliation and interrupted-upload cleanup.
- Light/Dark/System and ten accents, per-user preferences, responsive navigation and keyboard alternatives for item movement.
- Official MCP SDK 1.30.0 Streamable HTTP endpoint with 46 tools; no account-administration tools.
- Multi-stage Dockerfile, loopback-only Compose publication, nonroot runtime, persistent data volume, health checks and offline administrator recovery.

## Verification performed

| Check | Result |
| --- | --- |
| Backend integration suite | 17 tests passed against migrated temporary file-backed SQLite databases |
| Client tests | 4 passed: repeated query filters, complete pagination, stale ordering rejection and full-scope/version ordering |
| Formatting/lint | Ruff passed; frontend formatted with Prettier |
| Production client | TypeScript check and Vite production build passed |
| Container image | Built successfully; UID 10001; Node absent from runtime |
| Network boundary | Host port bound to 127.0.0.1; sibling container reached health endpoint; unauthenticated MCP rejected |
| Real MCP protocol | Initialize, discover all 46 tools, write comment and read activity over HTTP; permission denial and revoked access covered |
| Persistence | Removed/recreated disposable application container with the same volume; project and five item records retained |
| Full backup/restore | Clean stop, whole-data archive, restore to separate empty volume, login and counts verified; history retained and attachment bytes matched exactly |
| Browser workflows | Sign-in, Home, Planning, board, item details/history, per-visit ready prompt, explicit resume, cancellation impact dialog, text preview, browser multipart upload, user administration and appearance |
| Browser recovery | Forced expiry of disposable account sessions; same-account sign-in restored the unsaved description draft |
| Responsive/theme | 390px appearance layout inspected; light/accent preferences persisted after reload; desktop Planning document overflow corrected |
| Browser console | No warning/error entries during the reviewed workflows |

Tests use disposable accounts and separate volumes on ports 8081/8082. The working installation uses port 8080 and starts without seeded users or demo data. Its first administrator is created by the user.

## Scope and limits

This is the initial local release. It uses a single application process and a local filesystem for SQLite and attachments. Remote hosting/cloud agents, OAuth-only MCP clients, push updates, saved-query entities, configurable workflows, trash/recovery for deleted resources, rich document/media previews and the other deferred plan features remain outside this release.

The browser review is a workflow smoke check, not an exhaustive browser/accessibility or load benchmark. Automated tests target domain invariants, transactional rollback, permissions, protocol integration and recovery; the backend test runner currently emits one upstream Starlette/httpx deprecation warning.

See [running and development](../README.md), [REST conventions](api.md), [agent setup](agent-setup.md), and [backup/recovery](operations.md). The original preview gallery is retained separately from the working application.

The working installation was started with `docker compose up -d --no-build`; readiness and the first-admin setup state were confirmed. Disposable test containers, networks, volumes and the private backup archive were removed after verification. [Working sprint board screenshot](verification/screenshots/sprint-board.jpg) · [Clean initial setup](verification/screenshots/initial-setup.jpg).


## Sprint planning redesign — November 9, 2026

- Sprint descriptions are optional Markdown, available on create/edit, REST reads and MCP tools. Existing name-only clients remain compatible; description-only edits preserve the name.
- Alembic `0002` adds a non-null description with empty default. A populated `0001` database migration test verifies unchanged sprint lifecycle, versions, item membership/order and foreign keys.
- Planning initially lists all sprints without item lists. Selecting a sprint opens its complete ordered work above the independently filtered Backlog. Search, type, state, priority, assignee and label filters stay in the URL and apply only to Backlog.
- Native drag/drop adds Backlog work to the sprint and reorders sprint rows before a target or at the end. Visible handles, drag-enter acceptance and a synchronous drag snapshot support the tested browser. Add, move and up/down buttons are available as alternatives. Commands preserve state and validate complete scope/versions before committing.
- Sprint Overview (the default) shows description, all five state counts, links to matching items and Done/Cancelled closure progress. Board remains a separate selectable view. Both retain lifecycle controls and a Planning shortcut.
- Verification: **20 backend tests and 7 client tests passed**, Ruff and production TypeScript/Vite build passed. Browser checks exercised description editing, sprint-list-first navigation, filtering, native sprint reorder, native Backlog-to-sprint drop, moving back to Backlog, Overview/Board switching and a 390px layout with no horizontal page overflow.
- Deployment: the running app was upgraded on its configured loopback port **43200**. All preexisting users, projects, sprints, items, activity, attachment metadata and comments matched their pre-migration checksums after startup; existing descriptions were empty and foreign keys valid. A private full-data backup is retained at `backups/pre-sprint-descriptions-20261109.tar`, excluded from version control and Docker builds.

Current captures from disposable fixtures: [Sprint list](verification/screenshots/planning-sprints.jpg), [Selected planning](verification/screenshots/planning-selected.jpg), [Mobile planning](verification/screenshots/planning-mobile.jpg), [Sprint Overview](verification/screenshots/sprint-overview.jpg). Screens 05, 07 and 14 and their interactive gallery previews have been updated; original v2 images remain historical references.


## Backlog ordering — November 9, 2026

Planning now exposes persistent project-wide Backlog ordering through drag/drop, up/down arrows, Move to top (⇈), and an end-of-Backlog drop area. Filtered ordering moves matching rows relative to each other while preserving hidden items' relative order. Arrows work across pagination boundaries; top/end refer to the whole Backlog. Controls require item update permission and work independently of the selected sprint's lifecycle. They validate complete unfiltered membership and expected versions, refetch on conflict, record item history, and preserve state and priority.

Verification: **22 backend tests and 11 client tests passed**, along with Ruff and the production TypeScript/Vite build. Browser checks on a disposable 52-item Backlog verified drag reorder, up/down through a filter, global top/end, persistence after reload and both directions across a 50-item page boundary. A final API read confirmed the complete expected order, unchanged state/priority and preserved hidden-item order. Browser warnings/errors were absent. The app was updated on its existing loopback port 43200 with the same persistent data volume; no database migration or API change was required. The prior image remains tagged `local-planner:before-backlog-order` for rollback.

[Backlog ordering screenshot (sample data)](verification/screenshots/backlog-ordering.jpg). The planning specification, preview gallery and implementation plan include the new controls and filter semantics. Disposable verification containers/data were removed after checking the working app.


## Sprint lifecycle views and item type icons — November 9, 2026

Planning now defaults to the **Not started** tab, with separate **Active** and **Closed** tabs and counts. Selected sprint navigation and Backlog filter clearing retain the chosen category for returning to the catalog. Moving a sprint up/down swaps neighbors within the visible lifecycle while retaining the complete project ordering scope and leaving the other lifecycle positions intact. Closed sprints stay accessible in their own tab.

Item type has a shared, labeled SVG treatment: **Story = green bookmark**, **Task = blue checked square**, **Bug = red bug**. List and other shared item tables have a separate Type column. Board cards, Planning sprint/Backlog rows, item detail headers, selected type fields and selected type filters use the same shapes and colors. Light/dark tokens keep the icons legible; text remains visible and SVGs are decorative to avoid duplicate screen-reader names. Extra sprint columns have minimum readable widths within the table's existing scroll container.

Verification: production TypeScript/Vite build and **14 client tests passed**, including three tests for default/invalid sprint categories and cross-category ordering; the **22 backend tests passed** unchanged. Browser checks verified all lifecycle tabs, default Not started, group-local reorder, closed-sprint return navigation after clearing filters, the List Type column with optional columns on/off, all three icons in light/dark themes, sprint board icons and bug detail/type-selector icons. No browser warning/error entries were observed. Updated shared design specifications and offline gallery previews reflect both requests. No API or database migration is needed.

Captures from disposable fixtures: [Planning default](verification/screenshots/planning-status-default.jpg), [List dark](verification/screenshots/item-types-list-dark.jpg), [List light](verification/screenshots/item-types-list-light.jpg), [Sprint board](verification/screenshots/item-types-board.jpg).

The combined UI update was deployed on loopback port 43200 with readiness HTTP 200. The existing data volume was retained, and the previous image is available as `local-planner:before-sprint-status-types`. Disposable review data was removed.


## Always available active sprint — November 9, 2026

Removed the Active catalog tab. The single active sprint now has a dedicated summary above Not started (default) and Closed, visible in either catalog category and in selected-sprint planning workspaces. It provides planning, Board, Overview and permitted Close actions; if no sprint is active, the summary says so. Legacy `sprint_state=active` links use the default Not started category while keeping the active sprint visible. The existing database/service rule of at most one active sprint per project remains unchanged.

Verification: **22 backend and 14 client tests passed**, plus the production TypeScript/Vite build. Browser checks confirmed the active summary remains above both categories, no Active tab exists, selecting a closed sprint retains the active summary, and closing the active sprint from its summary immediately changes it to the no-active state. Browser warnings/errors were absent. The running app was updated on loopback port 43200, readiness returned HTTP 200, and the existing data volume was retained. No API or database migration was required; the prior image is tagged `local-planner:before-active-sprint-top`.

[Default Planning screenshot](verification/screenshots/planning-active-top.jpg) · [Active sprint above Closed](verification/screenshots/planning-active-with-closed.jpg). Captures use disposable fixtures; the verification container and volume were removed afterward.
