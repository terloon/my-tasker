# REST API

Base: `http://127.0.0.1:8080/api/v1`. The complete generated contract is [openapi.json](openapi.json); authenticated interactive documentation is at [/api/v1/docs](http://127.0.0.1:8080/api/v1/docs).

## Authentication

Browser login uses an HttpOnly, SameSite cookie. Fetch `/setup` first to receive the `lp_csrf` cookie. Browser mutation requests supply its value in `X-CSRF-Token`; login/setup are included. Allowed origins and hosts are explicit configuration. API/MCP clients exchange `{username,password}` at `POST /auth/token` and send `Authorization: Bearer <access_token>` on subsequent requests. API tokens default to 24 hours and browser sessions to 12 hours.

Credentials are never returned by ordinary user reads. Agent creation/rotation returns a generated UUID password once. Disabling a user or changing/rotating a password revokes that user's outstanding sessions/tokens.

## Mutations and concurrency

Mutable resources include `version` and return an ETag. Send the current value in `If-Match` for resource PATCH/delete/password operations. Multi-record commands carry expected versions in their body. A stale record returns 412, a missing precondition 428, and a domain/impact conflict 409. Explicit null clears only nullable assignee/sprint fields; omitted fields remain unchanged.

Applicable writes accept `Idempotency-Key`. Retries return the original result without duplicate history, and always recheck current authorization. A key reused for different input is rejected. Secret-bearing authentication and credential responses are not cached.

Collections have `{items,total,offset,limit}` with a default page size of 50 and maximum 200. Activity additionally returns `next_cursor`: pass it as `before` to read older history without new events shifting the page. Sort order is stable by timestamp and event ID. The React history view uses these cursors and pauses background refresh while reading older pages.

Errors have `{code,message,details,request_id}`. Denied invisible IDs return 404; insufficient action rights on a visible resource return 403. Busy writes return 503 with Retry-After. File limits return 413.

## Dependency commands

- Item create/PATCH can add `blocked_by_item_ids`. Entering Blocked requires at least one valid blocker. Parent/child/related links do not satisfy this rule. Dependency links are directed, allow multiple targets, stay within a project and may cross sprints. Cancelled targets and cycles are rejected.
- Item/card reads expose `blocker_summary`, including `ready_to_resume` and `blocker_revision`.
- `POST /items/{id}/resume` takes `{expected_version,blocker_revision}` and rechecks a nonempty all-Done blocker set before changing Blocked to In progress.
- `GET /items/{id}/cancellation-preview` returns the complete impact and its revision. `POST /items/{id}/cancel` takes `{expected_version,impact_revision,confirm_blocker_removal}`. Acknowledgment is required when there are dependents. Generic PATCH cannot bypass cancellation's impact command.
- Removing the final blocker link atomically returns a Blocked dependent to Open. It never automatically returns to In progress. Dependent Done/Cancelled items stay in their states.
- Deletion preview/delete use the same expected-impact protection. Item/link deletion returns 200 with automatic state changes; ordinary deletes return 204.

## Files and history

Upload multipart `file` to `/items/{id}/attachments`. The default byte limit is 25 MiB. Metadata and file finalization are recoverable; list/download exposes ready files. Text previews are bounded at 1 MiB. PNG, JPEG, GIF, WebP and BMP previews are decoded and re-encoded to safe bounded PNGs; other recognized binary files remain downloadable. HTML/SVG are never executed. UTF-8 text is returned as escaped text content.

`GET /items/{id}/activity` exposes the full authorized history of item changes. Project activity retains deletion events/tombstones after the item route disappears. History is append-only, actor/source/cause attributed and committed alongside mutations. Comment/file event details require their own resource visibility. No credentials or attachment bytes enter history.
