# Item list and query

Design baseline: v2, November 9, 2026. **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#06-item-list) · [Shared design guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Find work using a reusable, shareable set of structured filters.

Surface: **Page**. Route or entry: `/items`.

## Layout to preserve

Title, project context, search and filter chips, optional filter builder, compact table, count and pagination footer. No separate advanced-query screen.

Use the shared application shell, typography, spacing, colors and component rules. This screen does not establish its own palette or navigation model. The HTML preview is a visual baseline; the rules in this document define the complete behavior beyond the demonstrative interactions.

## Actions

- Filter and sort
- Open item
- Choose visible columns
- Clear filters
- Create item

## States to review

Use the gallery's State selector or the standalone preview's State control. Each variant retains the same screen identity and folder.

- `default`
- `filters`
- `empty`
- `loading`
- `read-only`
- `blockers-ready`

Shared states also apply: initial loading, failure/retry, submitting, invalid input, permission revocation, stale-version conflict, and session expiration whenever relevant. Consult the shared-state matrix; do not create a separate route for every transient state.

## Access and permissions

Only query projects/items the caller can view; create controls follow the selected project's item create grant.

Hide actions the user can never perform. When a permitted action is temporarily blocked by resource state, keep it discoverable with a visible reason and an available next step. Hidden data must not be rendered in the DOM merely because a control is hidden.

## Data and service contract

- `GET /items`
- `GET /items/hierarchy`
- `GET /metadata`
- `GET /projects/{project_id}/labels`
- `GET /projects/{project_id}/assignees`

Paths are relative to `/api/v1` where applicable. This preview uses fictional in-memory fixtures and performs no API requests. The implementation plan is authoritative for authentication, authorization and transactional invariants.

## Interaction and responsive behavior

- List is the default. Hierarchy uses the same columns and indents items beneath their parents. Branches start expanded and each parent has a keyboard-operable expand/collapse button. The selected view is saved in the URL.
- Filters keep matching items and their ancestors. Ancestors outside the filters are labeled and excluded from new bulk selections. Pagination keeps each top-level branch together.

- Desktop: shared 208px sidebar, 58px header, 30px content padding; primary action follows the page title or appears in the dialog footer.
- Tablet: stack supporting content before reducing readable text size. Keep wide tables/board columns in their own scroll containers.
- Mobile: use the 390px review preset and support 320px minimum; sidebar becomes a menu, properties stack, dialogs fit the viewport and actions wrap without clipping.
- Dialogs restore focus to their trigger, trap keyboard focus, and close with Escape except authentication-required transitions. Dirty editors use the Unsaved changes guard.
- Every visible field has a label; icon-only controls have accessible names; errors connect to fields and async results use polite status announcements.
- Every drag action also has a keyboard/menu equivalent. Never rely on color alone for state or permission meaning.
- Render all content in Light and Dark and check the ten accent colors. System follows the operating system.

## Screen-specific acceptance checklist

- [ ] Expose project, sprint/Backlog, type, state, assignee/Unassigned, labels, priority and updated-since.
- [ ] Filter/sort/pagination state lives in the URL; no JQL or saved-query management.
- [ ] Zero results retains filters and offers Clear filters.
- [ ] OR values within a field, AND fields, and all-selected-label matching are explained in the filter panel.
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

## Item type identification

Use the shared SVG type icons alongside visible labels: Story = green bookmark, Task = blue checked square, Bug = red bug. Shapes remain distinct without color. SVGs are decorative for assistive technology because the adjacent text supplies the name. List uses a separate Type column; boards, planning rows, item details and selected type controls use the same icons and light/dark treatment.
