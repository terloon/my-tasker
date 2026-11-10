# Change or reset password

Design baseline: v1, November 9, 2026. **Approved for implementation by the user, November 9, 2026.**

[Open preview](index.html) · [Review in gallery](../index.html#25-password-editor) · [Shared design guide](../design_guide.md) · [All screens](../README.md)

## Purpose and entry

Change one's human password or administratively reset another human's password.

Surface: **Dialog**. Route or entry: `Account settings or User details overlay`.

Parent surface: [12-account-security](../12-account-security/design.md).

## Layout to preserve

Current/new/confirm fields for self-service; only new/confirm for admin reset. Explain session revocation before the submit action.

Use the shared application shell, typography, spacing, colors and component rules. This screen does not establish its own palette or navigation model. The HTML preview is a visual baseline; the rules in this document define the complete behavior beyond the demonstrative interactions.

## Actions

- Change password
- Reset password
- Cancel

## States to review

Use the gallery's State selector or the standalone preview's State control. Each variant retains the same screen identity and folder.

- `default`
- `admin-reset`
- `validation`
- `submitting`

Shared states also apply: initial loading, failure/retry, submitting, invalid input, permission revocation, stale-version conflict, and session expiration whenever relevant. Consult the shared-state matrix; do not create a separate route for every transient state.

## Access and permissions

Current human user with existing password, or a human admin resetting a human account.

Hide actions the user can never perform. When a permitted action is temporarily blocked by resource state, keep it discoverable with a visible reason and an available next step. Hidden data must not be rendered in the DOM merely because a control is hidden.

## Data and service contract

- `PUT /auth/password`
- `POST /users/{user_id}/reset-password`

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

- [ ] Never show or retrieve the previous password.
- [ ] Self-change signs the user out after success and returns to Login.
- [ ] Agent credentials use rotation, not this dialog.
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
