window.DESIGN_SCREENS = [
  {
    "id": "01-setup",
    "name": "Initial setup",
    "group": "Main pages",
    "surface": "Page",
    "route": "/setup",
    "purpose": "Create the first human administrator on a fresh installation.",
    "layout": "Centered 410px form; brand above the title; username, password, confirmation, then one primary action. No application sidebar.",
    "actions": [
      "Create administrator",
      "Switch appearance"
    ],
    "states": [
      "default",
      "validation",
      "submitting",
      "already-initialized"
    ],
    "permissions": "Available only before initialization; afterward return to Login.",
    "apis": [
      "GET /setup",
      "POST /setup"
    ],
    "checks": [
      "No email, registration link, or team onboarding.",
      "Password rules and errors appear next to fields; never clear the username on failure.",
      "One successful submission leads to Home; a setup race leads to Login."
    ]
  },
  {
    "id": "02-login",
    "name": "Login",
    "group": "Main pages",
    "surface": "Page",
    "route": "/login",
    "purpose": "Sign a human user into the local application.",
    "layout": "Centered 410px username/password form matching Setup, with a show-password control and appearance shortcut.",
    "actions": [
      "Sign in",
      "Show or hide password"
    ],
    "states": [
      "default",
      "validation",
      "submitting"
    ],
    "permissions": "Public local entry; successful human login creates a session.",
    "apis": [
      "POST /auth/login",
      "GET /auth/me"
    ],
    "checks": [
      "Use a neutral invalid-credentials message; do not reveal whether the username exists.",
      "No public signup, email recovery, or external provider buttons.",
      "Return to a valid original destination after login."
    ]
  },
  {
    "id": "03-home",
    "name": "Home",
    "group": "Main pages",
    "surface": "Page",
    "route": "/",
    "purpose": "See all accessible projects and the work needing attention.",
    "layout": "Page title and New project action; project rows with active sprint and Done/Cancelled counts; a compact Assigned to you work table below.",
    "actions": [
      "Open project",
      "Open current sprint",
      "Open assigned item",
      "Create project"
    ],
    "states": [
      "default",
      "empty",
      "no-access",
      "loading",
      "read-only",
      "blockers-ready"
    ],
    "permissions": "Project and resource visibility govern rows and counts; New project is admin-only.",
    "apis": [
      "GET /home",
      "GET /projects"
    ],
    "checks": [
      "Projects can have different active sprints; do not invent one global current sprint.",
      "Done and Cancelled are separate counts.",
      "No-access copy differs from an empty installation; only admins see Create project.",
      "Blocked work shows blocker count and Ready to resume when every remaining blocker is Done; no automatic In-progress transition."
    ]
  },
  {
    "id": "04-project-overview",
    "name": "Project overview",
    "group": "Main pages",
    "surface": "Page",
    "route": "/projects/:id",
    "purpose": "Read project context and enter its planning and execution views.",
    "layout": "Project key, title and edit action; Overview and Activity tabs; readable description, restrained state summary, sprint rows and quick links.",
    "actions": [
      "Edit project",
      "Open Planning",
      "Open sprint",
      "Read project activity",
      "Manage permissions"
    ],
    "states": [
      "default",
      "activity",
      "empty",
      "loading",
      "read-only"
    ],
    "permissions": "Requires project view; editing requires project update; Permissions is admin-only; activity respects each resource's visibility.",
    "apis": [
      "GET /projects/{project_id}",
      "GET /projects/{project_id}/sprints",
      "GET /projects/{project_id}/activity"
    ],
    "checks": [
      "Keep the description prominent and editable through the project dialog.",
      "Project deletion is in the overflow menu and only available for empty projects to admins.",
      "No task or comment text leaks through activity when its resource is hidden."
    ]
  },
  {
    "id": "05-planning",
    "name": "Planning",
    "group": "Main pages",
    "surface": "Page",
    "route": "/projects/:id/planning",
    "purpose": "Choose a sprint, then plan its ordered work above a filterable Backlog.",
    "layout": "The single active sprint is always shown above Not started (default) and Closed tabs. Selected-sprint planning keeps the active summary accessible, with ordered sprint items above a filterable and reorderable Backlog. List and row type icons follow the shared type treatment.",
    "actions": [
      "Create sprint",
      "Reorder sprints",
      "Move selected items",
      "Start sprint",
      "Close sprint",
      "Create item",
      "Reorder Backlog",
      "Move Backlog item to top"
    ],
    "states": [
      "default",
      "selected",
      "empty",
      "loading",
      "read-only",
      "blockers-ready"
    ],
    "permissions": "Item and sprint view are required for their sections; moves require item update, sprint commands require sprint update.",
    "apis": [
      "GET /projects/{project_id}/sprints",
      "GET /items",
      "PUT /projects/{project_id}/sprint-order",
      "PUT /projects/{project_id}/item-order",
      "POST /projects/{project_id}/items/bulk-move"
    ],
    "checks": [
      "Backlog is a labeled section, not a sprint with lifecycle actions.",
      "A move preserves state; expose the destination in a menu as well as drag/drop.",
      "Sprints use Not started, Active, Closed; one active per project.",
      "A partial paginated list cannot be submitted as a complete reorder.",
      "Blocked work shows blocker count and Ready to resume when every remaining blocker is Done; no automatic In-progress transition."
    ]
  },
  {
    "id": "06-item-list",
    "name": "Item list and query",
    "group": "Main pages",
    "surface": "Page",
    "route": "/items",
    "purpose": "Find work using a reusable, shareable set of structured filters.",
    "layout": "Title, project context, search and filter chips, optional filter builder, compact table, count and pagination footer. No separate advanced-query screen. Type has its own icon-and-label column; titles contain no type badge.",
    "actions": [
      "Filter and sort",
      "Open item",
      "Choose visible columns",
      "Clear filters",
      "Create item"
    ],
    "states": [
      "default",
      "filters",
      "empty",
      "loading",
      "read-only",
      "blockers-ready"
    ],
    "permissions": "Only query projects/items the caller can view; create controls follow the selected project's item create grant.",
    "apis": [
      "GET /items",
      "GET /metadata",
      "GET /projects/{project_id}/labels",
      "GET /projects/{project_id}/assignees"
    ],
    "checks": [
      "Expose project, sprint/Backlog, type, state, assignee/Unassigned, labels, priority and updated-since.",
      "Filter/sort/pagination state lives in the URL; no JQL or saved-query management.",
      "Zero results retains filters and offers Clear filters.",
      "OR values within a field, AND fields, and all-selected-label matching are explained in the filter panel.",
      "Blocked work shows blocker count and Ready to resume when every remaining blocker is Done; no automatic In-progress transition."
    ]
  },
  {
    "id": "07-sprint-board",
    "name": "Sprint overview and board",
    "group": "Main pages",
    "surface": "Page",
    "route": "/projects/:id/sprints/:sprintId",
    "purpose": "Track the selected sprint through five explicit item states.",
    "layout": "Overview/Board navigation. Overview shows the optional Markdown description, all five item-state counts and completion; Board retains the state columns. Story uses a green bookmark, Task a blue checked square, Bug a red bug; retain visible labels.",
    "actions": [
      "Change item state",
      "Open item",
      "Select sprint",
      "Start or close sprint",
      "Create item"
    ],
    "states": [
      "default",
      "overview",
      "planned",
      "closed",
      "empty",
      "loading",
      "read-only",
      "blockers-ready"
    ],
    "permissions": "Requires sprint/item view for the board; item update enables transitions; sprint update enables lifecycle actions.",
    "apis": [
      "GET /sprints/{sprint_id}/board",
      "GET /projects/{project_id}/sprints",
      "PATCH /items/{item_id}",
      "GET /sprints/{sprint_id}"
    ],
    "checks": [
      "Column order is Open, In progress, Blocked, Done, Cancelled.",
      "Card menu offers the same transitions as dragging.",
      "Closed boards show the recorded timestamps and have no transition/create controls.",
      "Counts include all matching items; each column has independent Load more.",
      "Blocked work shows blocker count and Ready to resume when every remaining blocker is Done; no automatic In-progress transition."
    ]
  },
  {
    "id": "08-item-detail",
    "name": "Item detail",
    "group": "Main pages",
    "surface": "Page",
    "route": "/projects/:id/items/:itemId",
    "purpose": "Read and edit a work item, its links, discussion, files, and complete historical activity list.",
    "layout": "Key, title and overflow above a two-column detail page. Description, links, attachments and discussion occupy the main column; state/type/sprint/assignee/priority/labels occupy a 270px properties column. Story uses a green bookmark, Task a blue checked square, Bug a red bug; retain visible labels.",
    "actions": [
      "Edit title or description",
      "Change properties",
      "Link item",
      "Comment",
      "Upload or preview attachment",
      "Read activity",
      "Delete item"
    ],
    "states": [
      "default",
      "editing",
      "activity",
      "uploading",
      "closed-sprint",
      "read-only",
      "loading",
      "blocked",
      "blockers-ready",
      "blockers-ready-readonly",
      "blockers-removed",
      "resumed"
    ],
    "permissions": "Requires item view; properties use item update; discussion/files load only with their own view grants and have independent CRUD controls.",
    "apis": [
      "GET /items/{item_id}",
      "PATCH /items/{item_id}",
      "GET /items/{item_id}/links",
      "GET /items/{item_id}/comments",
      "GET /items/{item_id}/attachments",
      "GET /items/{item_id}/activity",
      "POST /items/{item_id}/resume",
      "GET /items/{item_id}/cancellation-preview",
      "POST /items/{item_id}/cancel"
    ],
    "checks": [
      "Descriptions use explicit Edit/Save/Cancel; a title or property edit cannot overwrite a newer version.",
      "Parent/child/related labels show the actual direction and allow different sprint badges.",
      "Closed-sprint state changes open Move item; description/comments/files remain editable with permission.",
      "Comment edit/delete is inline; uploading, failure and retry are attachment section states.",
      "Blocked by supports multiple same-project items and inverse Blocks links.",
      "Each visit to a ready Blocked item asks about In progress; Not now affects only this visit.",
      "Removing the final Blocked by link moves a Blocked item to Open, including cancellation/deletion cleanup.",
      "Cancelling a blocker previews every affected item and resulting automatic Open transitions.",
      "Activity is mandatory, append-only, and complete across human/agent/system changes; stable pagination reaches every authorized historical event."
    ]
  },
  {
    "id": "09-users",
    "name": "User administration",
    "group": "Main pages",
    "surface": "Page",
    "route": "/admin/users",
    "purpose": "Manage human and agent identities without confusing account type with project access.",
    "layout": "Title and Create user; kind/status filters; rows with name, username, Human/Agent, admin badge, enabled state and details action.",
    "actions": [
      "Create user",
      "Open user details",
      "Filter users"
    ],
    "states": [
      "default",
      "filtered",
      "loading",
      "empty"
    ],
    "permissions": "Human admin only; nonadmins see the Access denied screen.",
    "apis": [
      "GET /users"
    ],
    "checks": [
      "No password or UUID secret appears in the user table.",
      "Agent is a type badge, not an administrator role.",
      "Existing identities are disabled, never permanently deleted."
    ]
  },
  {
    "id": "10-project-permissions",
    "name": "Project permissions",
    "group": "Main pages",
    "surface": "Page",
    "route": "/projects/:id/settings/permissions",
    "purpose": "Assign explicit project CRUD grants to each human or agent.",
    "layout": "User chooser on the left and a resource-by-action checkbox matrix on the right. Selected identity and no-access default are visible above the matrix. Save/Discard form a stable footer.",
    "actions": [
      "Select user",
      "Edit grants",
      "Save permissions",
      "Discard changes",
      "Revoke access"
    ],
    "states": [
      "default",
      "no-grants",
      "dirty",
      "admin-user",
      "loading",
      "conflict"
    ],
    "permissions": "Human admin only; effective admin access is displayed separately from explicit grants.",
    "apis": [
      "GET /projects/{project_id}/permissions",
      "PUT /projects/{project_id}/permissions/{user_id}",
      "DELETE /projects/{project_id}/permissions/{user_id}"
    ],
    "checks": [
      "Rows: Project, Sprints, Items, Comments, Attachments. Columns: View, Create, Update, Delete.",
      "Project Create/Delete cells display Admin only, not active checkboxes.",
      "A write grant requires view; comment/file access also requires item view.",
      "Project view is the prerequisite; clear dependent grants only after an explicit local explanation.",
      "A grant-revision conflict preserves the draft and opens the conflict pattern."
    ]
  },
  {
    "id": "11-appearance",
    "name": "Appearance",
    "group": "Main pages",
    "surface": "Page",
    "route": "/settings/appearance",
    "purpose": "Choose appearance and accent without changing semantic status colors.",
    "layout": "Mode choices with small interface swatches; ten labeled accent circles; a compact real-component example. Preferences save on selection with inline Saved feedback.",
    "actions": [
      "Choose Light, Dark or System",
      "Choose accent"
    ],
    "states": [
      "default",
      "dark",
      "system",
      "saving",
      "error"
    ],
    "permissions": "Any signed-in user edits their own preferences only.",
    "apis": [
      "GET /me/preferences",
      "PATCH /me/preferences",
      "GET /metadata"
    ],
    "checks": [
      "Blue, Indigo, Purple, Pink, Red, Orange, Amber, Green, Teal and Slate are all named.",
      "System follows OS changes and is not labeled as a third palette.",
      "Keep Done/Blocked/error colors stable across accent changes.",
      "Save failure is visible; do not silently claim server persistence."
    ]
  },
  {
    "id": "12-account-security",
    "name": "Account and password",
    "group": "Main pages",
    "surface": "Page",
    "route": "/settings/account",
    "purpose": "Show the current human identity and provide password change and sign-out.",
    "layout": "Compact identity section, password-change row and sign-out row. No global user settings or project grants are editable here.",
    "actions": [
      "Change password",
      "Sign out"
    ],
    "states": [
      "default",
      "loading"
    ],
    "permissions": "Current human user only; role and username are read-only here.",
    "apis": [
      "GET /auth/me",
      "PUT /auth/password",
      "POST /auth/logout"
    ],
    "checks": [
      "Password change opens the shared password dialog and requires the current password.",
      "Explain that changing a password signs out existing sessions.",
      "Offline administrator recovery belongs in operations documentation, not a broken email reset link."
    ]
  },
  {
    "id": "13-project-editor",
    "name": "Create or edit project",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Home or Project overview overlay",
    "parent": "03-home",
    "purpose": "Capture the small amount of context needed to create or edit a project.",
    "layout": "520px dialog with name, immutable short project key on create, and Markdown description. Cancel left of the primary Create/Save action.",
    "actions": [
      "Create project",
      "Save project",
      "Cancel"
    ],
    "states": [
      "default",
      "edit",
      "validation",
      "submitting"
    ],
    "permissions": "Creation is human-admin only; editing requires project update.",
    "apis": [
      "POST /projects",
      "PATCH /projects/{project_id}"
    ],
    "checks": [
      "Name and key have visible labels and field-level validation.",
      "The key becomes read-only on edit, with a short explanation of item keys.",
      "No mandatory members, templates, dates or workflow configuration."
    ]
  },
  {
    "id": "14-sprint-editor",
    "name": "Create or edit sprint",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Planning overlay",
    "parent": "05-planning",
    "purpose": "Set the sprint name and optional description.",
    "layout": "Name and optional multiline Markdown description; existing sprints start with an empty description.",
    "actions": [
      "Create sprint",
      "Save changes",
      "Cancel"
    ],
    "states": [
      "default",
      "rename",
      "validation",
      "submitting"
    ],
    "permissions": "Sprint create or update according to the action.",
    "apis": [
      "POST /projects/{project_id}/sprints",
      "PATCH /sprints/{sprint_id}"
    ],
    "checks": [
      "New sprints append to the order and start Not started.",
      "No date fields and no stopped/paused controls.",
      "Rename does not change order or lifecycle."
    ]
  },
  {
    "id": "15-sprint-start",
    "name": "Start sprint",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Planning or Sprint board overlay",
    "parent": "05-planning",
    "purpose": "Confirm the transition into the project's only active sprint.",
    "layout": "Small confirmation with sprint name, item count, automatic start-time explanation, and Start sprint primary action.",
    "actions": [
      "Start sprint",
      "Cancel",
      "Open already active sprint"
    ],
    "states": [
      "default",
      "another-active",
      "submitting"
    ],
    "permissions": "Sprint update; server enforces one active sprint.",
    "apis": [
      "POST /sprints/{sprint_id}/start"
    ],
    "checks": [
      "Do not ask for dates or a completion target.",
      "If another sprint is active, replace the submit action with Open active sprint.",
      "Starting does not change item states."
    ]
  },
  {
    "id": "16-sprint-close",
    "name": "Close sprint and move work",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Planning or Sprint board overlay",
    "parent": "07-sprint-board",
    "purpose": "Close only after all remaining work is Done or Cancelled.",
    "layout": "Done/Cancelled/Unfinished summary; unfinished rows with their preserved states; another-sprint selector only when needed; clear final action label.",
    "actions": [
      "Close sprint",
      "Move unfinished and close",
      "Choose destination",
      "Cancel"
    ],
    "states": [
      "default",
      "ready",
      "no-destination",
      "submitting",
      "conflict"
    ],
    "permissions": "Sprint update, item view for preview, and item update when rolling unfinished work over.",
    "apis": [
      "GET /sprints/{sprint_id}/close-preview",
      "POST /sprints/{sprint_id}/close"
    ],
    "checks": [
      "Done and Cancelled may stay; Cancelled is not relabeled Completed.",
      "Do not offer Backlog as this command's rollover destination.",
      "Unfinished state is preserved and movement plus closure is atomic.",
      "A changed preview must refresh after a server conflict before another confirmation."
    ]
  },
  {
    "id": "17-item-create",
    "name": "Create item",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Home, Planning, List or Sprint overlay",
    "parent": "06-item-list",
    "purpose": "Create a story, task or bug with minimal required input.",
    "layout": "650px dialog: project context, type/title, description, then optional sprint/assignee/priority/labels. Advanced fields are not introduced.",
    "actions": [
      "Create item",
      "Create and open",
      "Cancel"
    ],
    "states": [
      "default",
      "backlog",
      "validation",
      "submitting",
      "blocked"
    ],
    "permissions": "Item create in chosen project; sprint selection needs sprint view; assignees are eligible users only.",
    "apis": [
      "POST /projects/{project_id}/items",
      "GET /metadata",
      "GET /projects/{project_id}/assignees",
      "GET /projects/{project_id}/labels"
    ],
    "checks": [
      "Title and type are the required item fields.",
      "Default state Open; sprint context inherits the current open/planned sprint, otherwise Backlog.",
      "Closed sprints are never selectable.",
      "Creation opens the created item; do not silently post multiple items on double click.",
      "Choosing Blocked requires at least one Blocked by item; create and links commit atomically."
    ]
  },
  {
    "id": "18-item-move",
    "name": "Move or reopen items",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Planning, List, Sprint or Item overlay",
    "parent": "05-planning",
    "purpose": "Move one or more items while keeping their states, or explicitly reopen a closed-sprint item.",
    "layout": "Selected work count, destination selector including Backlog, state-preservation note, and move action. Reopen variant adds the explicitly chosen new state.",
    "actions": [
      "Move items",
      "Move and reopen",
      "Cancel"
    ],
    "states": [
      "default",
      "single",
      "reopen",
      "validation",
      "submitting"
    ],
    "permissions": "Item update and destination sprint view.",
    "apis": [
      "POST /projects/{project_id}/items/bulk-move",
      "PATCH /items/{item_id}"
    ],
    "checks": [
      "Only same-project, nonclosed destinations are offered, plus Backlog.",
      "Ordinary movement never resets In progress or Blocked to Open.",
      "Reopen makes the new state explicit and combines it with movement in one update.",
      "Bulk operations succeed or fail together."
    ]
  },
  {
    "id": "19-item-link",
    "name": "Link items",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Item detail overlay",
    "parent": "08-item-detail",
    "purpose": "Add Parent, Child, Related, Blocked by or inverse Blocks links within a project.",
    "layout": "Relationship select, same-project key/title search results, selected target summary with state/sprint, Link item primary action.",
    "actions": [
      "Choose relationship",
      "Find target item",
      "Link item",
      "Cancel"
    ],
    "states": [
      "default",
      "parent",
      "no-results",
      "validation",
      "blocked-by",
      "blocks"
    ],
    "permissions": "Item update and view for both endpoints.",
    "apis": [
      "GET /items",
      "POST /items/{item_id}/links",
      "DELETE /items/{item_id}/links/{link_id}"
    ],
    "checks": [
      "Relationship label reads This item is parent of, child of, or related to target.",
      "Self-links, cycles, duplicate related links and a second parent are rejected visibly.",
      "Show the destination's sprint or Backlog; different sprints are valid.",
      "Multiple Blocked by targets are allowed; Cancelled items, self-links, duplicate edges and dependency cycles are rejected.",
      "Removing the last blocker changes a Blocked item to Open; adding links alone does not silently change state."
    ]
  },
  {
    "id": "20-label-manager",
    "name": "Manage project labels",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Item label picker or Project overview overlay",
    "parent": "08-item-detail",
    "purpose": "Create, rename or remove shared project labels in one compact surface.",
    "layout": "Project label list with name field, per-row rename/delete actions and an Add label row. No separate label navigation page.",
    "actions": [
      "Create label",
      "Rename label",
      "Delete label",
      "Done"
    ],
    "states": [
      "default",
      "empty",
      "validation",
      "read-only"
    ],
    "permissions": "Label creation uses item create, rename uses item update and deletion uses item delete; view uses item view.",
    "apis": [
      "GET /projects/{project_id}/labels",
      "POST /projects/{project_id}/labels",
      "PATCH /projects/{project_id}/labels/{label_id}",
      "DELETE /projects/{project_id}/labels/{label_id}"
    ],
    "checks": [
      "Label names are unique within the project.",
      "Deleting a label removes associations, not items, with a confirmation.",
      "Assignment happens in the item picker and follows item create/update permissions."
    ]
  },
  {
    "id": "21-attachment-preview",
    "name": "Attachment preview",
    "group": "Work dialogs",
    "surface": "Dialog",
    "route": "Item detail overlay",
    "parent": "08-item-detail",
    "purpose": "Inspect a common image or bounded text attachment without leaving the item.",
    "layout": "Wide dialog with filename, type/size, Download action, preview canvas and close button. Text uses a scrollable monospaced region.",
    "actions": [
      "Preview image or text",
      "Download file",
      "Close"
    ],
    "states": [
      "default",
      "text",
      "unsupported",
      "loading",
      "error"
    ],
    "permissions": "Item view and attachment view; the download repeats authorization.",
    "apis": [
      "GET /attachments/{attachment_id}",
      "GET /attachments/{attachment_id}/preview",
      "GET /attachments/{attachment_id}/content"
    ],
    "checks": [
      "Never execute HTML, SVG or Markdown HTML.",
      "Truncated text has a visible size/truncation note and download option.",
      "Unsupported files show filename/type and a Download action.",
      "Image scales to fit with its aspect ratio intact; navigation returns focus to its attachment tile."
    ]
  },
  {
    "id": "22-user-editor",
    "name": "Create or edit user",
    "group": "Administration dialogs",
    "surface": "Dialog",
    "route": "User administration overlay",
    "parent": "09-users",
    "purpose": "Create a human or an agent and edit permitted profile details.",
    "layout": "Human/Agent selector; human username/display name/password fields or agent display name and generated-identity explanation. Admin checkbox only for humans.",
    "actions": [
      "Create human",
      "Create agent",
      "Save details",
      "Cancel"
    ],
    "states": [
      "default",
      "agent",
      "edit",
      "validation",
      "submitting"
    ],
    "permissions": "Human admin only; agents cannot be admins.",
    "apis": [
      "POST /users",
      "PATCH /users/{user_id}"
    ],
    "checks": [
      "Agent creation does not ask the admin to invent a username or UUID password.",
      "New users have no project access until granted.",
      "Successful agent creation opens the one-time credentials screen.",
      "User kind cannot be silently changed after creation."
    ]
  },
  {
    "id": "23-user-detail",
    "name": "User details and account actions",
    "group": "Administration dialogs",
    "surface": "Side panel",
    "route": "User administration side panel",
    "parent": "09-users",
    "purpose": "Inspect identity and perform enable/disable/password actions.",
    "layout": "460px right panel with name/kind, stable username and public user ID, enabled/admin state, and grouped account actions.",
    "actions": [
      "Edit details",
      "Reset human password",
      "Rotate agent password",
      "Disable or enable user",
      "Close"
    ],
    "states": [
      "default",
      "human",
      "disabled",
      "last-admin"
    ],
    "permissions": "Human admin only; last enabled human admin cannot be disabled or demoted.",
    "apis": [
      "GET /users/{user_id}",
      "PATCH /users/{user_id}",
      "POST /users/{user_id}/reset-password",
      "POST /users/{user_id}/rotate-agent-password"
    ],
    "checks": [
      "Public user ID is clearly different from the secret UUID password, which is never retrievable.",
      "Disable warns that sessions are revoked but history remains.",
      "Credential rotation requires an explicit confirmation and opens a new one-time credentials view.",
      "No Delete user action."
    ]
  },
  {
    "id": "24-agent-credentials",
    "name": "One-time agent credentials",
    "group": "Administration dialogs",
    "surface": "Dialog",
    "route": "After agent creation or rotation",
    "parent": "09-users",
    "purpose": "Capture the generated username and UUID password once and then assign access.",
    "layout": "Readable username and monospaced secret, separate Copy actions, one-time visibility notice, no-project-access reminder, and Done/Manage permissions actions.",
    "actions": [
      "Copy username",
      "Copy UUID password",
      "Open project permissions",
      "Done"
    ],
    "states": [
      "default",
      "rotated",
      "copied"
    ],
    "permissions": "Human admin, immediately after successful creation/rotation only.",
    "apis": [
      "POST /users",
      "POST /users/{user_id}/rotate-agent-password"
    ],
    "checks": [
      "The preview contains an explicitly fictional credential, never a real token.",
      "Closing removes secret-bearing UI; reopening user detail cannot retrieve it.",
      "Rotation explains that old sessions/tokens are revoked.",
      "MCP setup documentation is a support link, not a server-administration screen."
    ]
  },
  {
    "id": "25-password-editor",
    "name": "Change or reset password",
    "group": "Administration dialogs",
    "surface": "Dialog",
    "route": "Account settings or User details overlay",
    "parent": "12-account-security",
    "purpose": "Change one's human password or administratively reset another human's password.",
    "layout": "Current/new/confirm fields for self-service; only new/confirm for admin reset. Explain session revocation before the submit action.",
    "actions": [
      "Change password",
      "Reset password",
      "Cancel"
    ],
    "states": [
      "default",
      "admin-reset",
      "validation",
      "submitting"
    ],
    "permissions": "Current human user with existing password, or a human admin resetting a human account.",
    "apis": [
      "PUT /auth/password",
      "POST /users/{user_id}/reset-password"
    ],
    "checks": [
      "Never show or retrieve the previous password.",
      "Self-change signs the user out after success and returns to Login.",
      "Agent credentials use rotation, not this dialog."
    ]
  },
  {
    "id": "26-delete-confirmation",
    "name": "Delete or disable confirmation",
    "group": "Administration dialogs",
    "surface": "Dialog",
    "route": "Resource-specific overlay",
    "parent": "08-item-detail",
    "purpose": "Make irreversible deletion and account-impacting actions explicit.",
    "layout": "Resource name, concrete consequence, any blocked preconditions, and a named destructive action beside Cancel. No generic Are you sure copy.",
    "actions": [
      "Delete resource",
      "Disable user",
      "Rotate credential",
      "Cancel"
    ],
    "states": [
      "default",
      "sprint",
      "project",
      "comment",
      "attachment",
      "label",
      "disable-user",
      "rotate-agent",
      "blocked",
      "unlink-blocker",
      "unlink-last-blocker",
      "delete-blocker"
    ],
    "permissions": "The exact resource delete/update grant applies; dependent comment/file deletion needs their delete grants.",
    "apis": [
      "DELETE resource endpoint",
      "PATCH /users/{user_id}",
      "POST /users/{user_id}/rotate-agent-password"
    ],
    "checks": [
      "Name the item/comment/file/label/sprint/project being affected.",
      "Project must be empty; sprint must be empty and not started; closed-sprint items must move first.",
      "Disable is not user deletion, and rotation is not account removal.",
      "Blocked variants offer a concrete next step instead of a clickable destructive button.",
      "Dependency removal lists affected items and confirms automatic Blocked -> Open when the last blocker is removed."
    ]
  },
  {
    "id": "27-edit-conflict",
    "name": "Edit conflict",
    "group": "Administration dialogs",
    "surface": "Dialog",
    "route": "Any versioned editor overlay",
    "parent": "08-item-detail",
    "purpose": "Keep a draft safe when a human or agent has changed the same resource.",
    "layout": "Who/what changed when available; side-by-side Your draft and Latest saved values; Keep editing and Load latest actions.",
    "actions": [
      "Keep editing",
      "Load latest",
      "Copy draft"
    ],
    "states": [
      "default",
      "permissions",
      "deleted"
    ],
    "permissions": "Never use conflict UI to expose a resource the caller can no longer view.",
    "apis": [
      "412 version conflict then authorized GET",
      "409 grant-revision/domain conflict then authorized GET"
    ],
    "checks": [
      "No blind overwrite or last-write-wins action.",
      "Keeping the draft does not claim it was saved; reapply deliberately against a newly fetched version.",
      "Deletion/access loss removes sensitive saved-resource data but allows copying locally entered draft text."
    ]
  },
  {
    "id": "28-access-denied",
    "name": "Access denied",
    "group": "System screens",
    "surface": "Page state",
    "route": "A known visible route with insufficient action/page access",
    "purpose": "Explain a denied visible action or admin-only page without leaking hidden resources.",
    "layout": "Application shell when valid, concise centered explanation, Back to Home primary action, optional Back secondary action.",
    "actions": [
      "Back to Home",
      "Back"
    ],
    "states": [
      "default"
    ],
    "permissions": "Visible resource plus missing action may be 403; invisible resources use Not found instead.",
    "apis": [
      "403 response"
    ],
    "checks": [
      "Do not reveal another project's name, item title or admin-only account details.",
      "Do not provide a fake Request access button because messaging is out of scope."
    ]
  },
  {
    "id": "29-not-found",
    "name": "Not found or deleted",
    "group": "System screens",
    "surface": "Page state",
    "route": "Unknown route or missing/invisible resource",
    "purpose": "Handle stale links and inaccessible identifiers without disclosing existence.",
    "layout": "Small Not found message in the normal shell, Home and Back actions; deleted variant only when deletion was already visible to the user.",
    "actions": [
      "Back to Home",
      "Back"
    ],
    "states": [
      "default",
      "deleted"
    ],
    "permissions": "Missing and invisible resource IDs produce the same neutral default state.",
    "apis": [
      "404 response"
    ],
    "checks": [
      "No resource metadata from the failed request appears in the default screen.",
      "A deleted variant is only used for an event the user was authorized to observe.",
      "Do not auto-create a project or item from a typo in a URL."
    ]
  },
  {
    "id": "30-service-unavailable",
    "name": "Connection or service error",
    "group": "System screens",
    "surface": "Page state",
    "route": "Any data-dependent page",
    "purpose": "Explain local connectivity/server failures and allow a safe retry.",
    "layout": "Retain the shell and page context, a concise connectivity message, Retry action and last-updated label when cached data is present.",
    "actions": [
      "Retry",
      "Back to Home"
    ],
    "states": [
      "default",
      "busy",
      "cached"
    ],
    "permissions": "Cached content remains visible only while its authenticated authorization context remains valid.",
    "apis": [
      "Network failure",
      "503 retryable busy response",
      "5xx response"
    ],
    "checks": [
      "Do not report unsaved changes as saved or clear a draft on a failed request.",
      "A busy database uses retry guidance, not a scary data-corruption message.",
      "No technical stack traces, paths or credentials appear in the product UI."
    ]
  },
  {
    "id": "31-session-expired",
    "name": "Session expired",
    "group": "System screens",
    "surface": "Dialog / auth transition",
    "route": "Any authenticated route -> /login",
    "parent": "08-item-detail",
    "purpose": "Pause an expired session and return to a valid destination after signing in.",
    "layout": "Compact session message, Sign in action and optional local draft copy when an edit was in progress; sensitive underlying content is obscured.",
    "actions": [
      "Sign in",
      "Copy unsaved draft"
    ],
    "states": [
      "default",
      "with-draft"
    ],
    "permissions": "After 401, stop authenticated polling and invalidate private caches; do not preserve another user's data after login.",
    "apis": [
      "401 response",
      "POST /auth/login"
    ],
    "checks": [
      "No password field is embedded in an arbitrary page overlay; use the Login screen.",
      "Never persist a draft containing a secret; keep ordinary unsaved text in memory only.",
      "Do not loop a background refresh indefinitely."
    ]
  },
  {
    "id": "32-unsaved-changes",
    "name": "Unsaved changes",
    "group": "System screens",
    "surface": "Dialog",
    "route": "Editor navigation guard",
    "parent": "08-item-detail",
    "purpose": "Protect explicit edits when navigating away or closing an editor.",
    "layout": "Short leave-page confirmation naming the edit, Keep editing primary action and Discard changes secondary action.",
    "actions": [
      "Keep editing",
      "Discard changes"
    ],
    "states": [
      "default",
      "permissions"
    ],
    "permissions": "This is a local navigation guard and does not create an extra backend approval step.",
    "apis": [
      "No request until an explicit Save action"
    ],
    "checks": [
      "No dialog for ordinary viewing or immediately saved property selections.",
      "Discard changes is not deletion of the saved item.",
      "A browser/tab close uses the native browser protection rather than a custom window."
    ]
  },
  {
    "id": "33-block-item",
    "name": "Move item to Blocked",
    "group": "Dependency dialogs",
    "surface": "Dialog",
    "route": "Any item state transition to Blocked",
    "parent": "08-item-detail",
    "purpose": "Require at least one Blocked by item before entering Blocked.",
    "layout": "Item context, existing blockers, searchable multi-select item results with states/sprints, and Add blockers and block action.",
    "actions": [
      "Select one or more blockers",
      "Move to Blocked",
      "Cancel"
    ],
    "states": [
      "default",
      "existing-blockers",
      "validation",
      "conflict"
    ],
    "permissions": "Item update and visibility of every same-project endpoint; a create form also requires item create.",
    "apis": [
      "PATCH /items/{item_id}",
      "POST /projects/{project_id}/items",
      "GET /items"
    ],
    "checks": [
      "Parent/Child/Related links do not satisfy the dependency requirement.",
      "At least one noncancelled blocker is required at commit; multiple blockers are supported.",
      "Existing blockers can satisfy the requirement; no forced duplicate selection.",
      "Store selected links and Blocked state atomically from board, detail, list, creation and MCP."
    ]
  },
  {
    "id": "34-blockers-resolved",
    "name": "All blockers are Done",
    "group": "Dependency dialogs",
    "surface": "Dialog",
    "route": "Every ready Blocked item detail visit",
    "parent": "08-item-detail",
    "purpose": "Ask whether to move a still-Blocked item to In progress after its nonempty blocker set is all Done.",
    "layout": "Blocked item context, list of Done blockers, reminder that the item remains Blocked, Not now and Move to In progress actions.",
    "actions": [
      "Move to In progress",
      "Not now"
    ],
    "states": [
      "default",
      "read-only",
      "conflict"
    ],
    "permissions": "View readiness with item view; moving requires item update and current readiness/version checks.",
    "apis": [
      "GET /items/{item_id}",
      "GET /items/{item_id}/links",
      "POST /items/{item_id}/resume"
    ],
    "checks": [
      "Ask on each item entry/re-entry/reload; do not persist dismissal or a do-not-ask-again option.",
      "Not now leaves Blocked and a persistent banner/action for the current visit.",
      "Polling does not repeatedly interrupt the same unchanged visit.",
      "Require at least one blocker and all Done; stale readiness cannot advance the item.",
      "Zero remaining links means automatic Open, never this dialog."
    ]
  },
  {
    "id": "35-cancel-blocker",
    "name": "Cancel item and remove blocker links",
    "group": "Dependency dialogs",
    "surface": "Dialog",
    "route": "Cancelling an item that blocks other items",
    "parent": "08-item-detail",
    "purpose": "Confirm every dependency removal and automatic Open transition caused by cancelling a blocker.",
    "layout": "Source item, explicit cancellation consequence, affected-item list showing Moves to Open or Remains Blocked, and Cancel item and remove links action.",
    "actions": [
      "Cancel item and remove links",
      "Keep item unchanged",
      "Refresh changed impact"
    ],
    "states": [
      "default",
      "remaining-done",
      "conflict",
      "read-only"
    ],
    "permissions": "Item update throughout the project; preview and command use the same authorization. No partial side effects on failure.",
    "apis": [
      "GET /items/{item_id}/cancellation-preview",
      "POST /items/{item_id}/cancel"
    ],
    "checks": [
      "List the full affected set; paginate without limiting the confirmation snapshot.",
      "Cancellation removes incoming Blocked by links, not Parent/Child/Related links or dependent items.",
      "A Blocked dependent with zero remaining blockers moves to Open atomically.",
      "A dependent with remaining Done blockers stays Blocked and prompts on its next view.",
      "A changed impact requires a refreshed confirmation; generic updates cannot bypass this flow."
    ]
  }
];
