# Item detail

Design baseline: v2, November 9, 2026. **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#08-item-detail) · [Shared design guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Read and edit a work item, its links, discussion, files and activity.

Surface: **Page**. Route or entry: `/projects/:id/items/:itemId`.

## Layout to preserve

Key, title and overflow above a two-column detail page. Description, links, attachments and discussion occupy the main column; state/type/sprint/assignee/priority/labels occupy a 270px properties column.

Use the shared application shell, typography, spacing, colors and component rules. This screen does not establish its own palette or navigation model. The HTML preview is a visual baseline; the rules in this document define the complete behavior beyond the demonstrative interactions.

## Actions

- Edit title or description
- Change properties
- Link item
- Comment
- Upload or preview attachment
- Read activity
- Delete item

## States to review

Use the gallery's State selector or the standalone preview's State control. Each variant retains the same screen identity and folder.

- `default`
- `editing`
- `activity`
- `uploading`
- `closed-sprint`
- `read-only`
- `loading`
- `blocked`
- `blockers-ready`
- `blockers-ready-readonly`
- `blockers-removed`
- `resumed`

Shared states also apply: initial loading, failure/retry, submitting, invalid input, permission revocation, stale-version conflict, and session expiration whenever relevant. Consult the shared-state matrix; do not create a separate route for every transient state.

## Access and permissions

Requires item view; properties use item update; discussion/files load only with their own view grants and have independent CRUD controls.

Hide actions the user can never perform. When a permitted action is temporarily blocked by resource state, keep it discoverable with a visible reason and an available next step. Hidden data must not be rendered in the DOM merely because a control is hidden.

## Data and service contract

- `GET /items/{item_id}`
- `PATCH /items/{item_id}`
- `GET /items/{item_id}/links`
- `GET /items/{item_id}/comments`
- `GET /items/{item_id}/attachments`
- `GET /items/{item_id}/activity`

- `POST /items/{item_id}/resume`
- `GET /items/{item_id}/cancellation-preview`
- `POST /items/{item_id}/cancel`

Paths are relative to `/api/v1` where applicable. This preview uses fictional in-memory fixtures and performs no API requests. The implementation plan is authoritative for authentication, authorization and transactional invariants.

## Interaction and responsive behavior

### Required historical activity list

The **Activity** tab is a formally required feature, separate from Comments. It must expose the complete authorized history of item changes, not just a recent-events sample.

- Record and display item creation/edits/deletion, changes to all properties, sprint/Backlog moves and ordering, labels, every link type, comment creation/edits/deletion, attachment additions/removals, and automatic blocker-related state changes.
- Include human, agent and system actions equally. Each entry shows who acted, the actor kind, timestamp, readable change and previous/new values where appropriate. Automatic actions explain their cause, such as “System moved Blocked -> Open because the last blocker was cancelled by calm-otter.”
- Group related events from one operation without hiding their individual effects. Link changes are available in the histories of both affected items; bulk actions have an entry for every changed item.
- Default to newest first with stable ordering. Provide Load older/pagination until every authorized event can be reached; do not silently retain only the latest page. Refreshing recent activity preserves the position of someone reading older events.
- History is read-only and durable. No Edit, Delete history or Clear history action. Keep it after sprint closure and movement, and retain deletion history through the authorized project activity view.
- Include initial loading, first-event/empty, failure/retry and restricted-history states. Historical comment/file details respect the same resource view permissions; do not expose credentials, file bytes or inaccessible linked-item details.
- Routine reads/polling/downloads are separate from this change timeline. The plan defines the event contract and transactional coverage; the current preview's sample entries illustrate layout rather than full event coverage.

- Desktop: shared 208px sidebar, 58px header, 30px content padding; primary action follows the page title or appears in the dialog footer.
- Tablet: stack supporting content before reducing readable text size. Keep wide tables/board columns in their own scroll containers.
- Mobile: use the 390px review preset and support 320px minimum; sidebar becomes a menu, properties stack, dialogs fit the viewport and actions wrap without clipping.
- Dialogs restore focus to their trigger, trap keyboard focus, and close with Escape except authentication-required transitions. Dirty editors use the Unsaved changes guard.
- Every visible field has a label; icon-only controls have accessible names; errors connect to fields and async results use polite status announcements.
- Every drag action also has a keyboard/menu equivalent. Never rely on color alone for state or permission meaning.
- Render all content in Light and Dark and check the ten accent colors. System follows the operating system.

## Screen-specific acceptance checklist

- [ ] Every item change category appears in Activity, including agent and automatic effects, with complete older-history navigation and durable attribution.
- [ ] Failed/rolled-back operations do not appear as successful changes, and a retry does not duplicate history.

- [ ] Descriptions use explicit Edit/Save/Cancel; a title or property edit cannot overwrite a newer version.
- [ ] Parent/child/related labels show the actual direction and allow different sprint badges.
- [ ] Closed-sprint state changes open Move item; description/comments/files remain editable with permission.
- [ ] Comment edit/delete is inline; uploading, failure and retry are attachment section states.
- [ ] Review desktop and mobile layouts with realistic long names/content.
- [ ] Review default, empty/error, read-only and mutation states relevant to this surface.
- [ ] Review Light/Dark and verify contrast/focus with at least Blue and the lightest accent, Amber.
- [ ] Record requested revisions here and in the shared guide when they affect other screens.

## Captured visual baseline

[Light screenshot](preview-light.jpg) · [Dark screenshot](preview-dark.jpg). The interactive preview also supports all listed states and accent colors.

## Dependency behavior update

- Every ready Blocked item-detail visit asks about In progress again. Not now only dismisses the current visit.

- Blocked by supports multiple same-project items and inverse Blocks links.
- Removing the final Blocked by link moves a Blocked item to Open, including cancellation/deletion cleanup.
- Cancelling a blocker previews every affected item and resulting automatic Open transitions.

See [block entry](../33-block-item/design.md), [ready prompt](../34-blockers-resolved/design.md), [cancellation confirmation](../35-cancel-blocker/design.md), and the shared [dependency flow](../dependency_flow.md). A nonempty all-Done blocker set asks about In progress; removing the final link moves a Blocked item to Open automatically.

## Review record

Status: Ready for review.

Decisions: the layout above is the proposed v1 baseline. Explicit user review is required before labeling this screen Approved; that label is a review record and does not block creating or refining previews.

Revision notes: Dependency workflow added November 9, 2026, including required blocker links, repeated ready prompt, cancellation impact and last-link removal -> Open.
