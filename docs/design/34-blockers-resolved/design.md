# All blockers are Done

Design baseline v2 · November 9, 2026 · **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#34-blockers-resolved) · [Shared guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Ask whether to move a still-Blocked item to In progress after its nonempty blocker set is all Done.

Surface: **Dialog**. Entry: Every ready Blocked item detail visit. Parent: [Item detail](../08-item-detail/design.md).

## Layout to preserve

Blocked item context, list of Done blockers, reminder that the item remains Blocked, Not now and Move to In progress actions.

Use the shared typography, color, spacing, keyboard and mobile-dialog patterns. On narrow screens, wrap affected-item titles and keep the outcome visible beside each item; allow internal vertical scrolling, with reachable actions.

## Actions

- Move to In progress
- Not now

## States to review

- `default`
- `read-only`
- `conflict`

## Permissions and data

View readiness with item view; moving requires item update and current readiness/version checks.

- `GET /items/{item_id}`
- `GET /items/{item_id}/links`
- `POST /items/{item_id}/resume`

Paths are under `/api/v1`. The implementation plan defines transactional behavior and error contracts; these previews use fictional data and do not perform mutations.

## Acceptance checklist

- [ ] Ask on each item entry/re-entry/reload; do not persist dismissal or a do-not-ask-again option.
- [ ] Not now leaves Blocked and a persistent banner/action for the current visit.
- [ ] Polling does not repeatedly interrupt the same unchanged visit.
- [ ] Require at least one blocker and all Done; stale readiness cannot advance the item.
- [ ] Zero remaining links means automatic Open, never this dialog.
- [ ] Verify Light/Dark, alternative accents, keyboard focus, and mobile width.
- [ ] Preserve entered selections and show a visible recovery path after validation/conflict.

## Captured visual baseline

[Light screenshot](preview-light.jpg) · [Dark screenshot](preview-dark.jpg).

## Review record

Status: Ready for review. New dependency behavior follows the user's requirements, including automatic Open after last-link removal. Layout is proposed and is not yet approved.
