# Cancel item and remove blocker links

Design baseline v2 · November 9, 2026 · **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#35-cancel-blocker) · [Shared guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Confirm every dependency removal and automatic Open transition caused by cancelling a blocker.

Surface: **Dialog**. Entry: Cancelling an item that blocks other items. Parent: [Item detail](../08-item-detail/design.md).

## Layout to preserve

Source item, explicit cancellation consequence, affected-item list showing Moves to Open or Remains Blocked, and Cancel item and remove links action.

Use the shared typography, color, spacing, keyboard and mobile-dialog patterns. On narrow screens, wrap affected-item titles and keep the outcome visible beside each item; allow internal vertical scrolling, with reachable actions.

## Actions

- Cancel item and remove links
- Keep item unchanged
- Refresh changed impact

## States to review

- `default`
- `remaining-done`
- `conflict`
- `read-only`

## Permissions and data

Item update throughout the project; preview and command use the same authorization. No partial side effects on failure.

- `GET /items/{item_id}/cancellation-preview`
- `POST /items/{item_id}/cancel`

Paths are under `/api/v1`. The implementation plan defines transactional behavior and error contracts; these previews use fictional data and do not perform mutations.

## Acceptance checklist

- [ ] List the full affected set; paginate without limiting the confirmation snapshot.
- [ ] Cancellation removes incoming Blocked by links, not Parent/Child/Related links or dependent items.
- [ ] A Blocked dependent with zero remaining blockers moves to Open atomically.
- [ ] A dependent with remaining Done blockers stays Blocked and prompts on its next view.
- [ ] A changed impact requires a refreshed confirmation; generic updates cannot bypass this flow.
- [ ] Verify Light/Dark, alternative accents, keyboard focus, and mobile width.
- [ ] Preserve entered selections and show a visible recovery path after validation/conflict.

## Captured visual baseline

[Light screenshot](preview-light.jpg) · [Dark screenshot](preview-dark.jpg).

## Review record

Status: Ready for review. New dependency behavior follows the user's requirements, including automatic Open after last-link removal. Layout is proposed and is not yet approved.
