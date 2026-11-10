# Move item to Blocked

Design baseline v2 · November 9, 2026 · **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#33-block-item) · [Shared guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Require at least one Blocked by item before entering Blocked.

Surface: **Dialog**. Entry: Any item state transition to Blocked. Parent: [Item detail](../08-item-detail/design.md).

## Layout to preserve

Item context, existing blockers, searchable multi-select item results with states/sprints, and Add blockers and block action.

Use the shared typography, color, spacing, keyboard and mobile-dialog patterns. On narrow screens, wrap affected-item titles and keep the outcome visible beside each item; allow internal vertical scrolling, with reachable actions.

## Actions

- Select one or more blockers
- Move to Blocked
- Cancel

## States to review

- `default`
- `existing-blockers`
- `validation`
- `conflict`

## Permissions and data

Item update and visibility of every same-project endpoint; a create form also requires item create.

- `PATCH /items/{item_id}`
- `POST /projects/{project_id}/items`
- `GET /items`

Paths are under `/api/v1`. The implementation plan defines transactional behavior and error contracts; these previews use fictional data and do not perform mutations.

## Acceptance checklist

- [ ] Parent/Child/Related links do not satisfy the dependency requirement.
- [ ] At least one noncancelled blocker is required at commit; multiple blockers are supported.
- [ ] Existing blockers can satisfy the requirement; no forced duplicate selection.
- [ ] Store selected links and Blocked state atomically from board, detail, list, creation and MCP.
- [ ] Verify Light/Dark, alternative accents, keyboard focus, and mobile width.
- [ ] Preserve entered selections and show a visible recovery path after validation/conflict.

## Captured visual baseline

[Light screenshot](preview-light.jpg) · [Dark screenshot](preview-dark.jpg).

## Review record

Status: Ready for review. New dependency behavior follows the user's requirements, including automatic Open after last-link removal. Layout is proposed and is not yet approved.
