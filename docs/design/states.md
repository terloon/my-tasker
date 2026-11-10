# Shared state and transition matrix

Use this matrix alongside every screen's own State selector and acceptance checklist. Variants belong to their screen folder; they are not separate navigation destinations.

| State or transition | Visual response | Interaction and data rule | Example |
| --- | --- | --- | --- |
| Initial loading | Skeletons in stable content geometry; short status | Do not fabricate counts or enable actions needing unknown grants | Home, board, detail |
| Background refresh | Existing data remains; quiet update | Preserve focus, scroll, selection and dirty edits | Agent updates a board item |
| Empty project list, admin | Start with a project and Create project | Only an admin gets that action | Home empty |
| No project access | No projects shared with you | No creation action, hidden project names or fake access-request workflow | Home no-access |
| No sprint | Clear no-active-sprint message and Planning link | Do not select another project's sprint | Project overview empty |
| Empty Backlog/sprint | Named section empty state with permitted Create/Move | Backlog has no lifecycle controls | Planning, board |
| Zero query matches | Keep filters visible, show zero count and Clear filters | Do not imply the installation has no data | Item list empty |
| Read-only resource | Normal readable data without edit affordances | Permission checks apply to independently loaded comments/files too | Item detail read-only |
| Permitted action blocked by state | Visible reason and next step | Disable submission; never rely on the UI alone | Another active sprint, closed work |
| Form validation | Field error and short form message | Preserve values; connect messages with aria-describedby | Create item validation |
| Submitting | Named progress label and disabled submit | Prevent duplicate submission; maintain form contents | Setup, create dialogs |
| Save/network failure | Persistent inline failure and Retry | Do not claim saved or clear the draft | Description or preferences |
| Partial content pagination | Counts plus Load more/next page | Never treat first page as a complete sprint/reorder scope | Board columns, list |
| Uploading file | Filename, progress, cancel if available | File is not ready/previewable until finalized | Item detail uploading |
| Unsupported preview | Type/filename and Download | Do not render active markup as a workaround | Attachment unsupported |
| Truncated text | Explicit truncation/size note and Download | Read only the bounded preview | Attachment text |
| Stale entity version | Draft/latest comparison | No blind overwrite; reapply against a fresh authorized version | Edit conflict |
| Permission revision conflict | Draft/latest grant summary | No last-write-wins grants; refresh and review | Permissions conflict |
| Permission revoked | Remove sensitive data and disallowed controls | Recheck every request; clear invalid cached content | Access denied/not found |
| Missing/invisible resource | Neutral Not found | Same default response; do not leak existence | Not found |
| Known authorized deletion | This item was deleted | Use specific copy only for a deletion already visible to the user | Not found deleted |
| Session expired | Obscure sensitive content, prompt Sign in | Stop polling; invalidate private caches; retain ordinary draft text in memory only | Session expired |
| Local service unavailable | Context, Retry, last-update label if valid cached data | No technical stack trace; do not mislabel unsaved work | Service unavailable |
| Database busy | Short retryable message | Honor retry guidance; do not imply corruption | Service busy |
| Dirty editor navigation | Keep editing / Discard changes | Applies only to unsaved explicit edits; saved resource stays intact | Unsaved changes |
| Closed sprint | Recorded Started/Closed, clear closure message | Done/Cancelled remain; no new members or in-place transitions; move out before reopening | Board closed |
| Cancelled item | Neutral named state with distinct marker | Not Done; allowed to remain when sprint closes | Any card/list/detail |
| Disabled user | Disabled badge and Enable action for admins | No sign-in; no deleted history; no username/secret reuse implication | User detail disabled |
| Last enabled admin | Reason beside blocked Disable/Demote | Preserve an enabled human admin | User detail last-admin |
| Credential generated | One-time secret view and copy controls | Never retrieve from user detail; never put secrets in activity | Agent credentials |
| Theme save failure | Selected preview plus clear Could not save / Retry | Do not silently claim account persistence | Appearance error |

The gallery explicitly previews major variants. Remaining transient behaviors are acceptance requirements for implementation; a notice in a static design preview is not proof that the real mutation flow exists.

## Dependency states added

| State | Presentation | Required behavior |
| --- | --- | --- |
| Blocked requested with zero dependencies | Multi-blocker selection, disabled submit until valid | Links and state commit together; Cancel restores prior state |
| Blocked with unresolved blockers | Blocked by count and target states | Multiple blockers allowed; no false Ready indicator |
| All remaining blockers Done | Ready banner plus per-visit resume dialog | Nonempty set only; Not now never persists across visits |
| Last blocker removed | Open plus All blockers removed feedback | Atomic automatic transition; no In-progress prompt |
| Cancelling a blocker | Full impact confirmation and result per dependent | Cancel, unlink and zero-link Open transitions commit together |
| Impact/readiness changed | Refresh/review conflict with original selection retained | No stale acknowledgment or silent state advance |
| Read-only ready item | Readiness and permission explanation | No enabled mutation control |
