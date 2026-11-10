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
