# Link items

Design baseline: v2, November 9, 2026. **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#19-item-link) · [Shared design guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Add Parent, Child, Related, Blocked by or inverse Blocks links within a project.

Surface: **Dialog**. Route or entry: `Item detail overlay`.

Parent surface: [08-item-detail](../08-item-detail/design.md).

## Layout to preserve

Relationship select, same-project key/title search results, selected target summary with state/sprint, Link item primary action.

Use the shared application shell, typography, spacing, colors and component rules. This screen does not establish its own palette or navigation model. The HTML preview is a visual baseline; the rules in this document define the complete behavior beyond the demonstrative interactions.

## Actions

- Choose relationship
- Find target item
- Link item
- Cancel

## States to review

Use the gallery's State selector or the standalone preview's State control. Each variant retains the same screen identity and folder.

- `default`
- `parent`
- `no-results`
- `validation`
- `blocked-by`
- `blocks`

Shared states also apply: initial loading, failure/retry, submitting, invalid input, permission revocation, stale-version conflict, and session expiration whenever relevant. Consult the shared-state matrix; do not create a separate route for every transient state.

## Access and permissions

Item update and view for both endpoints.

Hide actions the user can never perform. When a permitted action is temporarily blocked by resource state, keep it discoverable with a visible reason and an available next step. Hidden data must not be rendered in the DOM merely because a control is hidden.

## Data and service contract

- `GET /items`
- `POST /items/{item_id}/links`
- `DELETE /items/{item_id}/links/{link_id}`

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

- [ ] Relationship labels include Parent of, Child of, Related to, Blocked by and Blocks; inverse direction is explicit.
- [ ] Self-links, cycles, duplicate related links and a second parent are rejected visibly.
- [ ] Show the destination's sprint or Backlog; different sprints are valid.
- [ ] Review desktop and mobile layouts with realistic long names/content.
- [ ] Review default, empty/error, read-only and mutation states relevant to this surface.
- [ ] Review Light/Dark and verify contrast/focus with at least Blue and the lightest accent, Amber.
- [ ] Record requested revisions here and in the shared guide when they affect other screens.

## Captured visual baseline

[Light screenshot](preview-light.jpg) · [Dark screenshot](preview-dark.jpg). The interactive preview also supports all listed states and accent colors.

## Dependency behavior update

- Multiple Blocked by targets are allowed; Cancelled items, self-links, duplicate edges and dependency cycles are rejected.
- Removing the last blocker changes a Blocked item to Open; adding links alone does not silently change state.

See [block entry](../33-block-item/design.md), [ready prompt](../34-blockers-resolved/design.md), [cancellation confirmation](../35-cancel-blocker/design.md), and the shared [dependency flow](../dependency_flow.md). A nonempty all-Done blocker set asks about In progress; removing the final link moves a Blocked item to Open automatically.

## Review record

Status: Ready for review.

Decisions: the layout above is the proposed v1 baseline. Explicit user review is required before labeling this screen Approved; that label is a review record and does not block creating or refining previews.

Revision notes: Dependency workflow added November 9, 2026, including required blocker links, repeated ready prompt, cancellation impact and last-link removal -> Open.
