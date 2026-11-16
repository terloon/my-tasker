# Local Planner

A minimalist local project planner for humans and agents. FastAPI serves a React client, REST API and MCP endpoint from one container; SQLite and attachments live in a persistent volume.

## Run

```sh
cp .env.sample .env
docker compose up --build -d
```

Open [Local Planner](http://127.0.0.1:18473). Set `PLANNER_PORT` in `.env` to use another host port; it defaults to `18473` if unset or empty. Compose also adjusts the allowed browser origins to match. Apply port changes with `docker compose up -d`. On a fresh volume, choose the first administrator's username and password. There are no default accounts or passwords.

Create a project, add items and sprints, then create users or agents under Users. Grant each user access under the project's Permissions screen. New nonadmin accounts start with no project access; Agent is an account type, not an elevated role. Copy a generated agent UUID password before closing its credential dialog.

The host port is bound to loopback. Other local containers can use the private `local-planner` Docker network and the service name `app`; no public port exposure is needed.

## Workflows

- Planning keeps the active sprint at the top, above Not started (default) and Closed tabs. Select a sprint to see its ordered items above a filterable Backlog; drag to add or reorder sprint and Backlog items, or use the up/down and Move to top buttons. Sprints have optional descriptions and Overview/Board views.
- One active sprint per project. Done and Cancelled items can remain when closing; unfinished work can move to another sprint in the same atomic operation.
- In Planning, use **Flag question** and **Open questions** to track unresolved decisions. Keep the discussion in item comments. Return each flagged sprint item to **Open** before starting the sprint.
- Backlog contains items without a sprint. Moving an item preserves its state.
- Entering Blocked requires one or more Blocked by links. When all remaining blockers are Done, each visit to the item's detail asks about moving to In progress. It never resumes automatically.
- Cancelling a blocker previews and confirms the full impact. Removing a Blocked item's last blocker automatically moves it to Open, including cancellation/deletion cleanup.
- Story, Task and Bug use distinct labeled icons across List, Planning, the board and item details. List has a dedicated Type column.
- On Items, choose **Hierarchy** to expand or collapse parent/child branches. Search and filters apply in both views, and Hierarchy shows the ancestors of matching items for context.
- Item Activity records human, agent and automatic changes. Older history remains reachable and is not editable or clearable.
- Project, sprint and item descriptions, comments and Markdown attachments render Markdown with tables, checklists and code blocks. Attachments offer authorized previews. Light/Dark/System and ten accents are saved per user.

## Development

Python 3.12+, uv, Node 24 and npm are needed for development. Node is not present in the final runtime image.

```sh
uv sync --directory backend
cd backend
uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8080
```

In a second terminal, from the repository root:

```sh
npm ci --prefix frontend
npm run dev --prefix frontend
```

Open the Vite URL. Its API proxy keeps browser cookies on the same origin. For a native production-style run, build with `npm run build --prefix frontend`, then use the backend URL.

## Checks

```sh
cd backend
uv run pytest -q
uv run ruff check app tests migrations
```

From the repository root:

```sh
npm run test --prefix frontend
npm run build --prefix frontend
backend/.venv/bin/python scripts/export_openapi.py
npm run api:types --prefix frontend
docker build -t local-planner:local .
```

The isolated container check in `scripts/check_container.py` is deliberately restricted to loopback port 8081 and uses a disposable test account. Do not point it at your working installation.

See [REST/API conventions](docs/api.md), [agent connection](docs/agent-setup.md), [operations and recovery](docs/operations.md), the [implementation plan](docs/todo/pending/initial_implementation.md), and [approved design references](docs/design/README.md).

Implementation details and the verification record are in [docs/implementation-status.md](docs/implementation-status.md).
