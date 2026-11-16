# Planning

Design baseline: v3, November 9, 2026; updated for the user-requested sprint-first planning workflow. **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#05-planning) · [Shared design guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Organize Backlog and ordered sprints without changing item states.

Surface: **Page**. Route or entry: `/projects/:id/planning`.

## Layout to preserve

Initial sprint catalog only. Selected sprint: ordered items at top, filterable Backlog below. Drag Backlog into the sprint and reorder sprint rows; buttons provide keyboard equivalents.

Use the shared application shell, typography, spacing, colors and component rules. This screen does not establish its own palette or navigation model. The HTML preview is a visual baseline; the rules in this document define the complete behavior beyond the demonstrative interactions.

## Actions

- Create sprint
- Reorder sprints
- Move selected items
- Start sprint
- Flag an open item with a question or return a flagged item to Open directly from its row.
- Use the Open questions count above the sprint items to filter the list. In Backlog, choose Open question in the State filter.
- A planned sprint with open questions shows the blocking count and disables Start sprint until the flagged items are returned to Open.
- Close sprint
- Create item

## States to review

Use the gallery's State selector or the standalone preview's State control. Each variant retains the same screen identity and folder.

- `default`
- `selected`
- `empty`
- `loading`
- `read-only`
- `blockers-ready`

Shared states also apply: initial loading, failure/retry, submitting, invalid input, permission revocation, stale-version conflict, and session expiration whenever relevant. Consult the shared-state matrix; do not create a separate route for every transient state.

## Access and permissions

Item and sprint view are required for their sections; moves require item update, sprint commands require sprint update.

Hide actions the user can never perform. When a permitted action is temporarily blocked by resource state, keep it discoverable with a visible reason and an available next step. Hidden data must not be rendered in the DOM merely because a control is hidden.

## Data and service contract

- `GET /projects/{project_id}/planning`
- `GET /items`
- `PUT /projects/{project_id}/sprint-order`
- `POST /projects/{project_id}/items/bulk-move`

Paths are relative to `/api/v1` where applicable. This preview uses fictional in-memory fixtures and performs no API requests. The implementation plan is authoritative for authentication, authorization and transactional invariants.

## Interaction and responsive behavior

- Desktop: shared 208px sidebar, 58px header, 30px content padding; primary action follows the page title or appears in the dialog footer.
- Tablet: stack supporting content before reducing readable text size. Keep wide tables/board columns in their own scroll containers.
- Mobile: use the 390px review preset and support 320px minimum; sidebar becomes a menu, properties stack, dialogs fit the viewport and actions wrap without clipping.
- Dialogs restore focus to their trigger, trap keyboard focus, and close with Escape except authentication-required transitions. Dirty editors use the Unsaved changes guard.
- Every visible field has a label; icon-only controls have accessible names; errors connect to fields and async results use polite status announcements.
- Every drag action also has a keyboard/menu equivalent. Never rely on color alone for state or permission meaning.
- Render all content in Light and Dark and check the ten accent colors. System follows the operating system.

## Screen-specific acceptance checklist

- [ ] Backlog is a labeled section, not a sprint with lifecycle actions.
- [ ] A move preserves state; expose the destination in a menu as well as drag/drop.
- [ ] Sprints use Not started, Active, Closed; one active per project.
- [ ] A partial paginated list cannot be submitted as a complete reorder.
- [ ] Review desktop and mobile layouts with realistic long names/content.
- [ ] Review default, empty/error, read-only and mutation states relevant to this surface.
- [ ] Review Light/Dark and verify contrast/focus with at least Blue and the lightest accent, Amber.
- [ ] Record requested revisions here and in the shared guide when they affect other screens.

## Captured visual baseline

[Light screenshot](preview-light.jpg) · [Dark screenshot](preview-dark.jpg). The interactive preview also supports all listed states and accent colors.

## Dependency behavior update

- Blocked work shows blocker count and Ready to resume when every remaining blocker is Done; no automatic In-progress transition.

See [block entry](../33-block-item/design.md), [ready prompt](../34-blockers-resolved/design.md), [cancellation confirmation](../35-cancel-blocker/design.md), and the shared [dependency flow](../dependency_flow.md). A nonempty all-Done blocker set asks about In progress; removing the final link moves a Blocked item to Open automatically.

## Review record

Status: Ready for review.

Decisions: the layout above is the proposed v1 baseline. Explicit user review is required before labeling this screen Approved; that label is a review record and does not block creating or refining previews.

Revision notes: Dependency workflow added November 9, 2026, including required blocker links, repeated ready prompt, cancellation impact and last-link removal -> Open.

## Sprint planning redesign

Sprint descriptions are optional, support safe Markdown, and are editable after creation. Migration gives existing sprints an empty description while preserving names, contents, lifecycle and versions. Planning opens on all sprints; selected planning uses `?sprint=<id>`, with sprint items above a filtered Backlog. New items append; sprint rows can be dragged before another row or to the end. Reordering submits the complete membership and version snapshot. Search, type, state, priority, assignee and label filters apply only to Backlog. Buttons offer add, move and up/down equivalents. Sprint Overview and Board are selected using `?view=overview|board`; the default is Overview.

## Backlog ordering

Backlog has a persistent project-wide manual order, independent of the selected sprint's lifecycle. Users with item update permission can drag a Backlog row before another Backlog row, drop at the end of the full Backlog, use up/down arrows, or promote an item with Move to top (⇈). The ordering controls remain available while viewing a closed sprint; adding items into that sprint remains unavailable.

With filters applied, drag and up/down move between matching items while preserving hidden items' relative order. Move to top and the end drop area refer to the entire Backlog, including hidden items and other pages. Up/down works across page boundaries. Reorders validate the full unfiltered membership and versions, preserve item state/type/priority, record history, and refetch on conflict. Read-only users see the saved order without mutation controls.

## Sprint lifecycle separation

The catalog defaults to **Not started**, with separate **Active** and **Closed** tabs and counts. `?sprint_state=active|closed` selects a nondefault view. There is no mixed default list. Empty states are specific to each category. Selected sprint links and clearing Backlog filters preserve the category for return navigation. Reordering changes neighbors within the visible lifecycle group while submitting the full project sprint order and preserving the other groups. Closed sprints remain viewable and editable through their separate tab.

## Active sprint always available

There is no Active tab. The single active sprint is displayed in a dedicated summary above Not started and Closed, and remains visible in both catalog views and selected-sprint planning workspaces. It offers planning, Board, Overview and permitted closure actions. If no sprint is active, show an explicit empty summary. Not started stays the default; legacy `sprint_state=active` links fall back to Not started while keeping the active summary accessible. The server continues to enforce one active sprint per project.
