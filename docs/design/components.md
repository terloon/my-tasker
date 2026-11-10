# Shared component rules

Baseline v2. Use these rules with the [design guide](design_guide.md) and per-screen specifications.

## Application shell and navigation

- Brand goes to Home. The project switcher lists visible projects with name/key and active selection; choosing one updates project-scoped links. It does not change a cross-project query without the user's filter action.
- Main links are Home, Project overview, Planning, List and Sprint. Sprint points to the selected project's active sprint; with none, it presents the no-active-sprint state and a Planning link.
- Admin links are Users and project Permissions. They are absent for nonadmins; direct routes still enforce authorization.
- Appearance and Account sit at the bottom. The account menu repeats identity and provides Account/Sign out. It never exposes a generated agent password.
- Mobile navigation is a labeled menu with close/Escape/focus handling; page content becomes inert while it is open.
- Breadcrumbs are contextual links, not editable path text. Unknown/invisible resources never contribute a breadcrumb name.

## Buttons, links and menus

- Primary: filled accent with correct on-accent foreground. Secondary: neutral with strong boundary. Quiet: plain/ghost action. Destructive: named red-text action and explicit confirmation.
- Use action verbs: Create item, Start sprint, Move 5 items and close. Avoid Submit, Proceed and generic OK.
- A state-blocked action can remain disabled with a nearby explanation. An action denied by permanent permissions is hidden. Never render sensitive data in a hidden menu.
- Overflow actions include Rename/Delete sprint, Delete item/project, comment edit/delete and attachment download/delete as allowed. Menus use standard arrow keys, Escape and focus return.
- Preview notice messages stand in for some non-navigation interactions. They do not claim a real API operation succeeded.

## Item card

Order: readable key and type; wrapping title; at most two label chips plus a count; priority and assignee at the bottom. Link/comment/file indicators may be added only when accurate and permitted. Hover may reveal an action menu, but the same menu must be available through focus or an explicit visible trigger.

The card opens the full item detail route. A card action menu provides state transitions and Move item. Dragging is an additional method. Closed boards expose item reading/movement but no in-place state transition. Cancelled cards stay readable and are not faded to inaccessible contrast.

## Work table and query controls

- Default data fields: Key, Title/Type, State, Sprint, Priority, Assignee, Labels, Updated. A compact view can show a useful subset while the column chooser exposes the rest.
- Preview tables illustrate the common Key, Title/Type, State, Priority, Assignee layout; the List implementation must also include Sprint, Labels and Updated when selected.
- Sorting uses a labeled header button, active direction and deterministic tie-break. Item keys sort numerically within project keys.
- Search shows its query; filters use labeled chips and a clear action. Backlog and Unassigned are explicit choices.
- Bulk selection shows the selected count and permitted actions. Selection must not silently include hidden pages. Reorder commands must use complete scope data or an explicit move command, never a truncated rendered list.
- Counts and pagination remain visible with zero results. State board columns paginate independently.

## Forms and property pickers

- Labels sit above fields. Required fields have both visible and programmatic indication. Optional fields say Optional where ambiguity matters.
- Validation appears next to the field and in a short form-level message when needed. Preserve entered text after a recoverable failure.
- Item properties open anchored, searchable choices where useful: state/type/priority, nonclosed sprint plus Backlog, eligible assignee plus Unassigned, and multi-label selection.
- A property picker is an inline detail interaction, not the Create item dialog. Save selected changes with the current version; show pending/error/conflict feedback.
- Descriptions and comments have explicit Save/Cancel. Markdown preview disables active HTML. Comment editing replaces the comment body in place and retains author/editor attribution.
- Label picker offers Manage project labels only if the caller can perform a label operation. Viewing and assigning labels do not imply label administration.

## Dialog and side-panel behavior

- Dialog title and concrete context lead. Close icon has an accessible name; Escape and Cancel return focus to the launching control. Backdrop click is optional for clean nondestructive dialogs and must never discard a dirty form silently.
- Focus moves inside; the background is inert. Primary action is last in the footer. Long content scrolls without hiding the footer.
- User detail is a side panel because it contains related account actions rather than a single submission.
- Dirty forms use the Unsaved changes dialog. Browser-tab closing uses native protection; it cannot promise a custom modal.
- Submission disables the submit action and prevents double submission, while preserving the values. Error restores a deliberate retry path.

## Counts and lifecycle feedback

- Show Done, Cancelled and Unfinished separately. No combined Completed number includes Cancelled.
- Closing a sprint uses the current authorized preview and a named action. Another sprint is required for atomic rollover. The normal Move item dialog can use Backlog.
- Moving work preserves state. Reopening closed work explicitly selects the new state and a valid destination together.
- All relevant timestamps are labeled Started/Closed. Absolute times are available when a relative label is used. Format in the user's timezone.

## Permissions matrix

Rows are Project, Sprints, Items, Comments and Attachments; columns are View, Create, Update and Delete. Project Create/Delete say Admin only. Avoid a giant global permission screen spanning every project at once.

Selecting a write grant also selects its resource View grant and explains why. Clearing View with dependent writes or parent-view requirements requires a clear local explanation before clearing those grants. Effective admin rights are shown as an override; editing explicit rows cannot restrict an admin. Unsaved changes remain local until Save, with grant-revision conflict handling.

## Attachments and discussion

- Upload lives on Item detail. Show filename, size and progress, with cancel/retry when supported. Upload errors stay with the failed file, not only in a disappearing toast.
- Ready attachment tiles show a safe type/filename/size and authorized preview. Context menu has Download/Delete according to rights.
- Preview uses a wide image or escaped text region. Unsupported/failed previews retain Download if allowed. Text truncation is explicit. Active HTML/SVG never executes.
- Comments show identity, Agent badge if relevant, timestamp and edited attribution. Compose/edit/delete controls follow comment permissions independently from item update.

## Feedback

### Required item activity timeline

Keep Activity separate from Comments on Item detail. Each row has actor identity/kind, timestamp, readable change, previous/new field values where appropriate, and cause/operation context for automatic or multi-step actions. Include every committed item change from humans, agents and the system. Group related changes without losing individual effects, paginate through the complete authorized history, and preserve scroll position while refreshing newer events. The timeline is read-only; no clear/edit/delete-history control. Historical details obey current item/comment/file visibility. Full coverage, retention and event semantics are specified in the implementation plan and Item detail design.

- Inline status for field save/upload/preference outcomes; short toast for low-risk copy success. Important failure remains visible until acted on.
- Loading skeletons preserve rough geometry; no fake random counts.
- Empty states state what is missing and offer the permitted next action. No access and no data have different copy.
- Polling updates quietly, preserves editor drafts, and avoids moving keyboard focus. Conflicts never silently overwrite saved data.

## Preview implementation notes

The shared preview uses standard HTML/CSS/JavaScript with local assets. Some supporting pickers and menus display a preview explanation rather than reproducing every backend interaction. Screen states and per-screen documents define the required application behavior. This distinction prevents a mockup from being mistaken for an already implemented feature.

## Dependency indicators and confirmations

Blocked cards/rows show the blocker count; a nonempty all-Done set additionally shows Ready to resume. Item detail groups Blocked by and inverse Blocks separately from Parent/Child/Related. Every blocker row has a readable key/title/state and, where useful, sprint context.

State pickers route Blocked through required blocker selection and Cancelled through the impact-aware cancellation command. Create-item preserves its draft while choosing blockers inline. Existing dependencies can satisfy entry requirements. Never leave an optimistic card in an invalid Blocked state.

Ready-item entry asks about In progress each visit. Not now leaves the banner/action during that visit; no persisted dismissal. Removing the final link takes the different branch: automatic Open with explanatory feedback. Unlink/delete/cancel confirmations name affected items and their resulting states. See [dependency_flow.md](dependency_flow.md).
