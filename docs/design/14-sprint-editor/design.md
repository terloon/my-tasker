# Create or rename sprint

Design baseline: v1, November 9, 2026. **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#14-sprint-editor) · [Shared design guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Name a sprint without adding scheduling requirements.

Surface: **Dialog**. Route or entry: `Planning overlay`.

Parent surface: [05-planning](../05-planning/design.md).

## Layout to preserve

Name and optional multiline Markdown description; existing sprints start with an empty description.

Use the shared application shell, typography, spacing, colors and component rules. This screen does not establish its own palette or navigation model. The HTML preview is a visual baseline; the rules in this document define the complete behavior beyond the demonstrative interactions.

## Actions

- Create sprint
- Save name
- Cancel

## States to review

Use the gallery's State selector or the standalone preview's State control. Each variant retains the same screen identity and folder.

- `default`
- `rename`
- `validation`
- `submitting`

Shared states also apply: initial loading, failure/retry, submitting, invalid input, permission revocation, stale-version conflict, and session expiration whenever relevant. Consult the shared-state matrix; do not create a separate route for every transient state.

## Access and permissions

Sprint create or update according to the action.

Hide actions the user can never perform. When a permitted action is temporarily blocked by resource state, keep it discoverable with a visible reason and an available next step. Hidden data must not be rendered in the DOM merely because a control is hidden.

## Data and service contract

- `POST /projects/{project_id}/sprints`
- `PATCH /sprints/{sprint_id}`

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

- [ ] New sprints append to the order and start Not started.
- [ ] No date fields and no stopped/paused controls.
- [ ] Rename does not change order or lifecycle.
- [ ] Review desktop and mobile layouts with realistic long names/content.
- [ ] Review default, empty/error, read-only and mutation states relevant to this surface.
- [ ] Review Light/Dark and verify contrast/focus with at least Blue and the lightest accent, Amber.
- [ ] Record requested revisions here and in the shared guide when they affect other screens.

## Captured visual baseline

[Light screenshot](preview-light.jpg) · [Dark screenshot](preview-dark.jpg). The interactive preview also supports all listed states and accent colors.

## Review record

Status: Ready for review.

Decisions: the layout above is the proposed v1 baseline. Explicit user review is required before labeling this screen Approved; that label is a review record and does not block creating or refining previews.

Revision notes: None yet.

## Sprint planning redesign

Sprint descriptions are optional, support safe Markdown, and are editable after creation. Migration gives existing sprints an empty description while preserving names, contents, lifecycle and versions. Planning opens on all sprints; selected planning uses `?sprint=<id>`, with sprint items above a filtered Backlog. New items append; sprint rows can be dragged before another row or to the end. Reordering submits the complete membership and version snapshot. Search, type, state, priority, assignee and label filters apply only to Backlog. Buttons offer add, move and up/down equivalents. Sprint Overview and Board are selected using `?view=overview|board`; the default is Overview.
