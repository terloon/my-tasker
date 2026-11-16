# Local Planner design guide

Baseline v2 · November 9, 2026 · Approved for implementation by the user.

This guide and the [screen inventory](README.md) translate the [implementation plan](../todo/pending/initial_implementation.md) into concrete visual and interaction decisions. The [preview gallery](index.html) is the review surface. Each screen folder contains its approved design baseline and selectable visual states. The user approved the screens and requested implementation on November 9, 2026. The previews remain design references; the running application is served separately on port 8080.

## Direction

A quiet workbench for one person and their agents. Show context, the current state, and the next action. Use a compact sidebar, readable work rows and predictable forms. Avoid decorative dashboards, oversized metrics, gradients, large illustrations and customization panels unrelated to planning.

The proposed product label is **Local Planner**, a working name rather than a naming requirement. The demo uses a project with the same name, key PLAN. The product brand and selected project remain separate concepts in navigation.

## Information architecture

- **Home** is global: visible projects, each active sprint, and assigned work.
- **Project overview**, **Planning**, and **Sprint** use the selected project.
- **List** can span projects; its project filter starts from the selected context. Cross-project queries never imply cross-project links.
- **Item detail** is a full route, making deep links and long descriptions predictable. Item creation uses a dialog; item editing stays on the detail page.
- **Users** is installation administration. **Permissions** belongs to a project and is administered by human admins.
- **Appearance** and **Account** are personal settings.
- Creation, movement, linking, previews and confirmations use dialogs or a user-detail side panel. They do not add permanent sidebar entries.
- Backlog, Cancelled, state lanes and activity are views/sections, not additional entity types or navigation trees.

The [inventory](README.md) lists all 35 surfaces and the interactions intentionally kept inline. Do not add a separate page merely to expose a REST endpoint. Stock API documentation and local agent setup are support tools, not custom planning screens.

## Layout geometry

| Element | Baseline |
| --- | --- |
| Desktop review frame | 1440px wide; content responds to the actual viewport |
| Sidebar | 208px; 180px between 761px and 1100px |
| Application header | 58px; 56px on mobile |
| Content padding | 30px desktop, 24px laptop, 22px/16px mobile; 36px/42px on very large screens |
| Content maximum width | 1600px, centered inside the application main column |
| Main page header | Title and description at left, contextual primary action at right; stack on mobile |
| Detail properties | 270px, reducing to 230px on smaller desktop; stack below the content on mobile |
| Main gutters | 24–30px; local component gaps 8–16px |
| Standard dialogs | 440–650px depending on task; wide comparison/file dialogs up to 820px |
| User details side panel | 460px, right-aligned, full height |
| Dialog safety margin | 30px desktop, 12px mobile; internal content may scroll |
| Tables and boards | Own horizontal overflow; the entire application should not scroll horizontally |

Use a 4px spacing rhythm: 4, 8, 12, 16, 20, 24, 28, 32. Small deviations for text/border alignment are acceptable; arbitrary per-screen spacing is not.

The desktop sidebar has brand, project switcher, main navigation, admin group and account/settings at the bottom. The header contains breadcrumb/context and appearance/account shortcuts. Do not repeat the same create action in both the global header and page header. The preview uses the page header as the authoritative location.

## Typography

Use the local system font stack: `-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`. Use the system monospace stack for item-independent IDs, example credentials and text/code previews. No external font request is required.

| Role | Size / weight |
| --- | --- |
| Page title | 26px / 650; 23px on mobile |
| Dialog title | 21px / 650 |
| Section title | 17px / 600 |
| Body and forms | 14px / 400 |
| Work rows and card titles | 13px / 400–550 |
| Metadata, timestamps, keys | 12px / 400–500 |
| Compact badges and table headers | 11px / 550; never use for essential instructions |
| Body line height | 1.5; description prose 1.8 |

Use sentence case. Keep timestamps quieter than content. Use tabular numerals for item numbers and counts. Titles may wrap; dense tables may truncate a title only when the complete value remains available through an accessible tooltip and its item link. Do not reduce type size to accommodate long content.

## Color tokens

`assets/design.css` contains the preview implementation. The application should implement equivalent semantic CSS properties and keep them independent of component names.

| Semantic token | Light | Dark |
| --- | --- | --- |
| Background | `#f6f7f9` | `#0e121b` |
| Surface | `#ffffff` | `#151c28` |
| Raised surface | `#ffffff` | `#1b2433` |
| Foreground | `#172033` | `#edf2f8` |
| Secondary foreground | `#536277` | `#a5b1c4` |
| Decorative divider | `#d8dee8` | `#334155` |
| Control boundary | `#66758a` | `#8290a5` |
| Information / In progress | `#1d4ed8` | `#60a5fa` |
| Success / Done | `#166534` | `#86efac` |
| Warning / Blocked | `#92400e` | `#fcd34d` |
| Error / destructive text | `#b91c1c` | `#fca5a5` |
| On-accent text | `#ffffff` | `#0e121b` |

Decorative dividers are not the only visible boundary for form controls. Use the stronger boundary token for inputs and unfilled buttons. The selected navigation item has both a soft accent background and a solid 3px accent indicator. A focus ring is a 2px accent outline with 3px offset; never remove it.

### Accent palette

| Name | Light filled action | Dark filled action |
| --- | --- | --- |
| Blue, default | `#1d4ed8` | `#60a5fa` |
| Indigo | `#4338ca` | `#a5b4fc` |
| Purple | `#7e22ce` | `#c084fc` |
| Pink | `#be185d` | `#f9a8d4` |
| Red | `#b91c1c` | `#fca5a5` |
| Orange | `#c2410c` | `#fdba74` |
| Amber | `#92400e` | `#fcd34d` |
| Green | `#15803d` | `#86efac` |
| Teal | `#0f766e` | `#5eead4` |
| Slate | `#475569` | `#cbd5e1` |

Light accents use white foreground; dark accents use the dark background token as foreground. Selected soft backgrounds mix 8% of the light accent into a light surface or 12% of the dark accent into a dark surface. Do not put white text on the pale dark-mode accent colors.

Light, Dark and System are modes; accents are a separate preference. System follows live OS changes. An accent must not recolor item outcome meanings. Open and Cancelled use neutral markers, In progress uses information blue, Blocked amber, and Done green, independent of the chosen accent. Cancelled uses a horizontal marker rather than a completion tick.

Use at least 4.5:1 contrast for normal text and 3:1 for large text; meaningful control/focus boundaries need 3:1 against adjacent colors. Follow the existing plan's references to [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Contrast validation notes are in [verification.md](verification.md).

## Components and interaction language

The [component rules](components.md) define navigation, buttons, tables, cards, fields, selection, dialogs, menus, feedback and previews. The [state matrix](states.md) defines loading, emptiness, errors, conflicts, authentication and permission changes.

- One primary action per local task. Secondary actions have a neutral surface; ordinary navigation remains a link. Keep destructive actions in contextual overflow or their confirmation surface.
- Use 6px control radius, 7–8px card radius, and 10px dialog radius. Shadows are reserved for overlays and popovers, with at most a subtle card shadow.
- Fine-pointer controls are 36–38px tall; coarse-pointer controls have a minimum 44px effective target and 16px editable text.
- No important action exists only on hover. Menus need labels, keyboard operation and focus return.
- Descriptions and comments use an explicit editor with Save/Cancel. Property selections save immediately with visible pending/error feedback. Switching an unsaved editor uses the shared navigation guard.
- Background polling updates quietly. It must not reorder a user's active editing context, wipe a draft, or flood the screen reader with refresh announcements.

## Domain language to preserve

| Concept | User-facing language and behavior |
| --- | --- |
| Sprint lifecycle | Not started, Active, Closed. No Stop, Pause or Resume action. |
| Item states | Open, In progress, Blocked, Done, Cancelled. Never show Incomplete. |
| Backlog | Items without a sprint. No Start/Close actions on Backlog. |
| Sprint closure | Done and Cancelled may remain. Move unfinished work to another sprint, preserving states. |
| Completion | Done counts as completed work; Cancelled is separate. |
| Current sprint | Selected project's active sprint; Home can show several projects' active sprints. |
| Agent | Account type, indicated with an Agent badge. It carries no extra privilege. |
| Links | Parent, Child, Related, Blocked by and inverse Blocks. Multiple blockers; one parent; same project, possibly different sprints. |
| UUID password | One-time secret for an agent. It is not the public user ID. |
| Disabled account | Cannot sign in; authored history remains. No Delete user action. |

## Responsive design

- Design primarily for desktop without sacrificing mobile reading and key actions.
- At widths up to 760px, replace the sidebar with an accessible menu. Stack title/action groups, project rows, detail properties and most form fields.
- Keep five sprint state columns in their own horizontal scroll area instead of compressing cards below 190px. Preserve column names/counts while scrolling vertically.
- Make tables horizontally scroll within a labeled region when columns cannot fit; keep item titles/links readable. Do not silently hide meaningful columns without a column chooser or mobile alternative.
- Permission matrices keep their resource labels and checkbox names; the user chooser becomes a horizontal selection area on mobile.
- Dialogs fit the viewport, permit content scrolling and keep footers reachable. No clipped primary actions or double horizontal scrolling.
- Review at 1440, 1100, 834 and 390px presets, plus a 320px minimum check. Review large fonts/200% zoom during implementation.

## Accessibility and motion

Use semantic landmarks, labels and table headings. Route changes update document title and move focus to the page heading in the application. Modal focus is trapped and restored; background content is inert. Match the screenshot appearance without replacing real controls with inaccessible drawing primitives.

Associate errors with fields. Use `role=alert` for submission failures and polite status messages for saving/copying. State, type, priority, user kind and permission meaning must be available in text. Provide keyboard/menu equivalents for drag/drop and visible reasons for blocked actions.

Use restrained 120–160ms hover/menu transitions, no animated page entrances or looping decoration, and honor reduced motion. The current previews avoid animation so layout can be judged directly.

## Preview scope and review process

The previews contain realistic fictional fixtures, static counts and selected demonstration interactions. No database, API, actual permission changes, or credentials are involved. State selectors are review tools; they are not added to the product. The ten accent themes and Light/Dark/System are implemented in the preview, not just described.

Each `design.md` records purpose, layout, actions, permissions, state variants, service contract, acceptance checks and review status. When a shared decision changes, update this guide, components and previews together. When a screen is agreed, record the user's approval in its review record; do not infer approval because the preview was generated.

The implementation plan retains domain authority. Revisions to these designs must preserve its confirmed sprint and permission rules unless the user explicitly changes them. No new product feature should appear only in a preview.

## Dependency workflow update

Follow [the full dependency design](dependency_flow.md). Entering Blocked requires at least one Blocked by link. A nonempty all-Done blocker set prompts on every item-detail visit about In progress, with no automatic resume. Removing the last link automatically moves a Blocked item to Open. Cancelling a blocker confirms all affected items and resulting automatic Open transitions before committing the compound change.


## Required item history

Every committed item change must be recorded and available in the Item detail Activity tab, including human, agent and automatic system actions. This is a confirmed product requirement. Show actor/kind, time, readable change, old/new values where appropriate and cause/operation grouping; stable pagination must reach the complete authorized history. History is durable and read-only, separate from Comments. See [Item detail](08-item-detail/design.md) and the implementation plan for coverage, retention and permission rules.

## Sprint planning revision (November 9, 2026)

Planning now starts with a sprint catalog. A selected sprint opens a vertical workspace: complete ordered sprint items above a filterable Backlog. Sprint descriptions are optional Markdown, with empty descriptions on preexisting sprints. Sprint pages switch between Overview (description and state statistics) and Board. Existing theme, permission, version-conflict and keyboard-equivalence rules apply. See updated screens 05, 07 and 14.

## Type icons and sprint lifecycle tabs

Item type is identified by shape, color and text together: Story has a green bookmark; Task a blue checked square; Bug a red bug. Use the shared 18px SVG treatment with visible labels across lists, planning, board cards, detail headers and selected type controls. List has a separate Type column. Match light/dark tokens and avoid color-only identification.

The Planning catalog defaults to Not started, with a separate Closed tab. A dedicated active sprint summary stays above both lists and selected-sprint workspaces. There is no Active tab. Keep category counts visible and preserve the chosen view when returning from a selected sprint.
