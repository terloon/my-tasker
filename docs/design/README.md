# Approved screen inventory and design references

Approved for implementation by the user on November 9, 2026.

**35 surfaces:** 12 main pages, 18 work/administration/dependency dialogs or side panels, and 5 system screens/transitions. These cover the implementation plan's initial scope. Variants such as a closed sprint or image versus text preview live with their parent screen, keeping navigation minimalist.

Start with the [interactive review gallery](index.html), the [design guide](design_guide.md), or the [implementation plan](../todo/pending/initial_implementation.md). The gallery opens on Home; use the ordered list or Next/Previous to review every screen. Each folder has a standalone `index.html` preview and `design.md` specification.

Each screen folder also contains rendered **light and dark screenshots**, linked from its design notes. See [verification notes](verification.md) for the preview/state/layout and contrast checks performed.

The previews work offline when opened in a standard browser and have no external dependencies. They are design artifacts with fictional data, not the application. Nothing changes users, permissions, files or the database. Controls demonstrate navigation, form appearance, states and themes; some actions show explanatory preview feedback. Every variant is selectable from the State menu. Width, mode and accent controls belong to the reviewer, not the product.

If your browser restricts local embedded previews, serve this directory on loopback using `python3 -m http.server 8765 --bind 127.0.0.1 --directory docs/design` from the repository root, then open `http://127.0.0.1:8765/`. Stop that preview server when finished. No dependency installation is needed.

## Complete inventory

| # | Screen | Surface | Route or entry | Preview |
| --- | --- | --- | --- | --- |
| 01 | [Initial setup](01-setup/design.md) | Page | `/setup` | [Preview](01-setup/index.html) |
| 02 | [Login](02-login/design.md) | Page | `/login` | [Preview](02-login/index.html) |
| 03 | [Home](03-home/design.md) | Page | `/` | [Preview](03-home/index.html) |
| 04 | [Project overview](04-project-overview/design.md) | Page | `/projects/:id` | [Preview](04-project-overview/index.html) |
| 05 | [Planning](05-planning/design.md) | Page | `/projects/:id/planning` | [Preview](05-planning/index.html) |
| 06 | [Item list and query](06-item-list/design.md) | Page | `/items` | [Preview](06-item-list/index.html) |
| 07 | [Sprint board](07-sprint-board/design.md) | Page | `/projects/:id/sprints/:sprintId` | [Preview](07-sprint-board/index.html) |
| 08 | [Item detail](08-item-detail/design.md) | Page | `/projects/:id/items/:itemId` | [Preview](08-item-detail/index.html) |
| 09 | [User administration](09-users/design.md) | Page | `/admin/users` | [Preview](09-users/index.html) |
| 10 | [Project permissions](10-project-permissions/design.md) | Page | `/projects/:id/settings/permissions` | [Preview](10-project-permissions/index.html) |
| 11 | [Appearance](11-appearance/design.md) | Page | `/settings/appearance` | [Preview](11-appearance/index.html) |
| 12 | [Account and password](12-account-security/design.md) | Page | `/settings/account` | [Preview](12-account-security/index.html) |
| 13 | [Create or edit project](13-project-editor/design.md) | Dialog | `Home or Project overview overlay` | [Preview](13-project-editor/index.html) |
| 14 | [Create or rename sprint](14-sprint-editor/design.md) | Dialog | `Planning overlay` | [Preview](14-sprint-editor/index.html) |
| 15 | [Start sprint](15-sprint-start/design.md) | Dialog | `Planning or Sprint board overlay` | [Preview](15-sprint-start/index.html) |
| 16 | [Close sprint and move work](16-sprint-close/design.md) | Dialog | `Planning or Sprint board overlay` | [Preview](16-sprint-close/index.html) |
| 17 | [Create item](17-item-create/design.md) | Dialog | `Home, Planning, List or Sprint overlay` | [Preview](17-item-create/index.html) |
| 18 | [Move or reopen items](18-item-move/design.md) | Dialog | `Planning, List, Sprint or Item overlay` | [Preview](18-item-move/index.html) |
| 19 | [Link items](19-item-link/design.md) | Dialog | `Item detail overlay` | [Preview](19-item-link/index.html) |
| 20 | [Manage project labels](20-label-manager/design.md) | Dialog | `Item label picker or Project overview overlay` | [Preview](20-label-manager/index.html) |
| 21 | [Attachment preview](21-attachment-preview/design.md) | Dialog | `Item detail overlay` | [Preview](21-attachment-preview/index.html) |
| 22 | [Create or edit user](22-user-editor/design.md) | Dialog | `User administration overlay` | [Preview](22-user-editor/index.html) |
| 23 | [User details and account actions](23-user-detail/design.md) | Side panel | `User administration side panel` | [Preview](23-user-detail/index.html) |
| 24 | [One-time agent credentials](24-agent-credentials/design.md) | Dialog | `After agent creation or rotation` | [Preview](24-agent-credentials/index.html) |
| 25 | [Change or reset password](25-password-editor/design.md) | Dialog | `Account settings or User details overlay` | [Preview](25-password-editor/index.html) |
| 26 | [Delete or disable confirmation](26-delete-confirmation/design.md) | Dialog | `Resource-specific overlay` | [Preview](26-delete-confirmation/index.html) |
| 27 | [Edit conflict](27-edit-conflict/design.md) | Dialog | `Any versioned editor overlay` | [Preview](27-edit-conflict/index.html) |
| 28 | [Access denied](28-access-denied/design.md) | Page state | `A known visible route with insufficient action/page access` | [Preview](28-access-denied/index.html) |
| 29 | [Not found or deleted](29-not-found/design.md) | Page state | `Unknown route or missing/invisible resource` | [Preview](29-not-found/index.html) |
| 30 | [Connection or service error](30-service-unavailable/design.md) | Page state | `Any data-dependent page` | [Preview](30-service-unavailable/index.html) |
| 31 | [Session expired](31-session-expired/design.md) | Dialog / auth transition | `Any authenticated route -> /login` | [Preview](31-session-expired/index.html) |
| 32 | [Unsaved changes](32-unsaved-changes/design.md) | Dialog | `Editor navigation guard` | [Preview](32-unsaved-changes/index.html) |
| 33 | [Move item to Blocked](33-block-item/design.md) | Dialog | `Any item state transition to Blocked` | [Preview](33-block-item/index.html) |
| 34 | [All blockers are Done](34-blockers-resolved/design.md) | Dialog | `Every ready Blocked item detail visit` | [Preview](34-blockers-resolved/index.html) |
| 35 | [Cancel item and remove blocker links](35-cancel-blocker/design.md) | Dialog | `Cancelling an item that blocks other items` | [Preview](35-cancel-blocker/index.html) |

## Supporting interactions contained within screens

These have no additional routes/folders because their design is included with the owning screen:

| Interaction | Owning design |
| --- | --- |
| Project switcher, account menu, appearance shortcut, collapsed navigation | [Shared components](components.md) |
| Query builder, column chooser, sorting and pagination | [Item list](06-item-list/design.md) |
| Backlog selection, sprint ordering, item ranking and load-more | [Planning](05-planning/design.md) |
| Card action menu and per-column load-more | [Sprint board](07-sprint-board/design.md) |
| Title/description editing and state/type/priority/assignee/label pickers | [Item detail](08-item-detail/design.md) |
| Comment compose/edit/delete, upload/progress/retry and attachment actions | [Item detail](08-item-detail/design.md) |
| Project and item activity | [Project overview](04-project-overview/design.md), [Item detail](08-item-detail/design.md) |
| Permission prerequisite explanations and unsaved matrix changes | [Project permissions](10-project-permissions/design.md) |
| API reference | Stock authenticated FastAPI/OpenAPI documentation; retain its generated layout, no additional custom product screen |
| Agent client configuration and offline admin recovery | Written operational documentation and local client/command-line flows, not product screens |

## Dependency workflow

[Full behavior and design flow](dependency_flow.md): require blockers to enter Blocked; prompt on every detail visit when all remaining blockers are Done; confirm cancellation impact; automatically move to Open when the final blocker link is removed.

## Review method

1. Review Home, Planning, Sprint board and Item detail first to settle shell, density and component language.
2. Review the remaining main pages, then supporting dialogs and system states.
3. For each surface, check its variants and at least Light/Dark, one other accent, and the Mobile width.
4. Record changes in the screen's `design.md`; apply shared decisions in `design_guide.md` and `components.md`.
5. Mark a screen Approved only after user review. All surfaces currently say Ready for review.

The design baseline does not add deferred features: no sprint pause, custom workflows, remote access, estimates, notifications, JQL, or separate activity/label/comment management routes.
