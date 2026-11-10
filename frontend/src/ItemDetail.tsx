import { ask } from "./ui";
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  api,
  uploadAttachment,
  can,
  label,
  priorities,
  query,
  states,
  types,
  when,
  type Attachment,
  type Comment,
  type Impact,
  type Item,
  type Label,
  type LinkEdge,
  type Page,
  type Sprint,
  type User,
} from "./api/client";
import {
  Activity,
  Empty,
  ErrorBox,
  Field,
  Heading,
  Loading,
  Modal,
  Pagination,
  Person,
  State,
  useCollection,
  useData,
  useWrite,
} from "./ui";
import {
  CandidatePicker,
  ImpactList,
  MoveDialog,
  ResumeDialog,
  StateDialog,
} from "./dialogs";

export default function ItemDetail() {
  const { itemId } = useParams();
  return <Detail key={itemId} itemId={itemId!} />;
}
function Detail({ itemId }: { itemId: string }) {
  const q = useData<Item>(["item", itemId], `/items/${itemId}`);
  const item = q.data;
  const w = useWrite();
  const [tab, setTab] = useState("comments");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [draftVersion, setDraftVersion] = useState(0);
  const [transition, setTransition] = useState<string | null>(null);
  const [move, setMove] = useState<{ reopen?: string } | null>(null);
  const [addLink, setAddLink] = useState(false);
  const [labelManager, setLabelManager] = useState(false);
  const [resume, setResume] = useState(false);
  const [deleting, setDeleting] = useState<Impact | null>(null);
  const [unlink, setUnlink] = useState<LinkEdge | null>(null);
  const seenReady = useRef(new Set<string>());
  const navigation = useBlocker(
    ({ currentLocation, nextLocation }) =>
      editing && currentLocation.pathname !== nextLocation.pathname,
  );
  const links = useData<{ items: LinkEdge[]; item_version: number }>(
    ["links", itemId],
    `/items/${itemId}/links`,
    !!item,
  );
  const sp = useCollection<Sprint>(
    ["sprints", item?.project_id],
    `/projects/${item?.project_id}/sprints?limit=200`,
    can(item, "sprint"),
  );
  const users = useData<User[]>(
    ["assignees", item?.project_id],
    `/projects/${item?.project_id}/assignees`,
    can(item, "item", "update"),
  );
  const labels = useData<Label[]>(
    ["labels", item?.project_id],
    `/projects/${item?.project_id}/labels`,
    !!item,
  );
  useEffect(() => {
    if (
      item?.state === "blocked" &&
      item.blocker_summary.ready_to_resume &&
      can(item, "item", "update") &&
      !seenReady.current.has(item.blocker_summary.blocker_revision)
    ) {
      seenReady.current.add(item.blocker_summary.blocker_revision);
      setResume(true);
    }
    if (item && !item.blocker_summary.ready_to_resume) setResume(false);
  }, [
    item?.id,
    item?.state,
    item?.blocker_summary.blocker_revision,
    item?.blocker_summary.ready_to_resume,
  ]);
  useEffect(() => {
    if (!editing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing]);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  if (!item) return <Empty title="Item not found" />;
  const i = item;
  async function update(body: Record<string, unknown>) {
    await w.execute(() =>
      api(`/items/${i.id}`, { method: "PATCH", version: i.version, body }),
    );
  }
  async function changeState(state: string) {
    if (state === i.state) return;
    if (i.sprint_state === "closed") {
      setMove({ reopen: state });
      return;
    }
    if (state === "blocked" || state === "cancelled") {
      setTransition(state);
      return;
    }
    await update({ state });
  }
  const related = (links.data?.items || []).filter(
    (e) => !["blocked_by", "blocks"].includes(e.relationship),
  );
  const blockers = (links.data?.items || []).filter(
    (e) => e.relationship === "blocked_by",
  );
  const blocks = (links.data?.items || []).filter(
    (e) => e.relationship === "blocks",
  );
  function linkedRow(edge: LinkEdge) {
    return (
      <div className="dependency-row" key={edge.id}>
        <div className="grow">
          <span className="badge">{label(edge.relationship)}</span>{" "}
          <Link to={`/projects/${edge.item.project_id}/items/${edge.item.id}`}>
            {edge.item.key} · {edge.item.title}
          </Link>
          <div className="small muted">
            {edge.item.sprint_name} · <State state={edge.item.state} />
          </div>
        </div>
        {can(i, "item", "update") && (
          <button className="btn small ghost" onClick={() => setUnlink(edge)}>
            Remove
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="eyebrow">
        <Link to={"/items?project_id=" + i.project_id}>Items</Link> / {i.key}{" "}
        <span className="badge">{label(i.type)}</span>
      </div>
      <Heading
        title={i.title}
        actions={
          can(i, "item", "delete") && (
            <details className="overflow-menu">
              <summary className="btn ghost" aria-label="Item actions">
                •••
              </summary>
              <div className="menu-popover">
                <button
                  className="btn ghost full danger-text"
                  onClick={() =>
                    api<Impact>(`/items/${i.id}/deletion-preview`)
                      .then(setDeleting)
                      .catch(w.setError)
                  }
                >
                  Delete item
                </button>
              </div>
            </details>
          )
        }
      />
      {!!w.error && <ErrorBox error={w.error} retry={() => q.refetch()} />}{" "}
      {w.message && (
        <div className="callout" role="status">
          {w.message}
        </div>
      )}{" "}
      {i.state === "blocked" && i.blocker_summary.ready_to_resume && (
        <div className="dependency-banner">
          <div>
            <strong>All blockers are Done</strong>
            <p>
              {can(i, "item", "update")
                ? "This item is still Blocked. Move it to In progress when ready."
                : "You do not have permission to change its state."}
            </p>
          </div>
          {can(i, "item", "update") && (
            <button
              className="btn primary small"
              onClick={() => setResume(true)}
            >
              Move to In progress
            </button>
          )}
        </div>
      )}
      {i.sprint_state === "closed" && (
        <div className="callout">
          This item is in a closed sprint. Move it out before changing its
          state.
        </div>
      )}
      <div className="detail-grid">
        <div>
          <section>
            <div className="section-head">
              <h2>Description</h2>
              {can(i, "item", "update") && (
                <button
                  className="btn ghost small"
                  onClick={async () => {
                    if (
                      editing &&
                      description !== i.description &&
                      !(await ask("Discard the unsaved description draft?"))
                    )
                      return;
                    setEditing(!editing);
                    setDescription(i.description);
                    setTitle(i.title);
                    setDraftVersion(i.version);
                  }}
                >
                  {" "}
                  {editing ? "Cancel" : "Edit"}
                </button>
              )}
            </div>
            {editing ? (
              <div className="stack">
                <Field name="Title">
                  <input
                    value={title}
                    maxLength={300}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Field>
                <Field name="Description" hint="Markdown supported.">
                  <textarea
                    rows={8}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                {draftVersion !== i.version && (
                  <div className="form-error">
                    <h3>This item changed while you were editing</h3>
                    <div className="diff-grid">
                      <div>
                        <strong>Your draft</strong>
                        <pre className="event-details">{description}</pre>
                      </div>
                      <div>
                        <strong>Latest saved</strong>
                        <pre className="event-details">{i.description}</pre>
                      </div>
                    </div>
                    <div className="row">
                      <button
                        className="btn small"
                        onClick={() => {
                          setDescription(i.description);
                          setTitle(i.title);
                          setDraftVersion(i.version);
                        }}
                      >
                        Load latest
                      </button>
                      <button
                        className="btn small"
                        onClick={() => setDraftVersion(i.version)}
                      >
                        Keep draft against this version
                      </button>
                    </div>
                  </div>
                )}
                <div className="row">
                  <button
                    className="btn primary"
                    disabled={
                      w.busy || !title.trim() || draftVersion !== i.version
                    }
                    onClick={() =>
                      w
                        .execute(() =>
                          api(`/items/${i.id}`, {
                            method: "PATCH",
                            version: draftVersion,
                            body: { title, description },
                          }),
                        )
                        .then(() => setEditing(false))
                        .catch(() => {})
                    }
                  >
                    Save description
                  </button>
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      if (
                        description === i.description ||
                        (await ask("Discard unsaved changes?"))
                      )
                        setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose markdown">
                <ReactMarkdown skipHtml>
                  {i.description || "No description yet."}
                </ReactMarkdown>
              </div>
            )}
          </section>
          <section className="section">
            <div className="section-head">
              <h2>Dependencies</h2>
              {can(i, "item", "update") && (
                <button
                  className="btn ghost small"
                  onClick={() => setAddLink(true)}
                >
                  + Add link
                </button>
              )}
            </div>
            <div className="panel">
              <h3>
                Blocked by <span className="count">{blockers.length}</span>
              </h3>
              {blockers.length ? (
                blockers.map(linkedRow)
              ) : (
                <p className="small muted">No blockers linked.</p>
              )}
              <h3 style={{ marginTop: 18 }}>
                Blocks <span className="count">{blocks.length}</span>
              </h3>
              {blocks.length ? (
                blocks.map(linkedRow)
              ) : (
                <p className="small muted">No items depend on this item.</p>
              )}
            </div>
          </section>
          <section className="section">
            <div className="section-head">
              <h2>Linked items</h2>
            </div>
            {related.length ? (
              <div className="quiet-band">{related.map(linkedRow)}</div>
            ) : (
              <p className="small muted">
                No parent, children or related links.
              </p>
            )}
          </section>
          {can(i, "attachment") && <Files item={i} />}
          <section className="section">
            <div className="tabs">
              {can(i, "comment") && (
                <button
                  className={"tab " + (tab === "comments" ? "active" : "")}
                  onClick={() => setTab("comments")}
                >
                  Comments
                </button>
              )}
              <button
                className={"tab " + (tab === "activity" ? "active" : "")}
                onClick={() => setTab("activity")}
              >
                Activity
              </button>
            </div>
            {tab === "activity" || !can(i, "comment") ? (
              <Activity projectId={i.project_id} itemId={i.id} />
            ) : (
              <Comments item={i} />
            )}
          </section>
        </div>
        <aside className="detail-side">
          <Field name="State">
            <select
              disabled={!can(i, "item", "update")}
              value={i.state}
              onChange={(e) => changeState(e.target.value).catch(() => {})}
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Type">
            <select
              disabled={!can(i, "item", "update")}
              value={i.type}
              onChange={(e) => update({ type: e.target.value }).catch(() => {})}
            >
              {types.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Sprint">
            <select
              disabled={!can(i, "item", "update") || !can(i, "sprint")}
              value={i.sprint_id || ""}
              onChange={(e) =>
                update({ sprint_id: e.target.value || null }).catch(() => {})
              }
            >
              <option value="">Backlog</option>
              {sp.data?.items
                .filter((s) => s.state !== "closed" || s.id === i.sprint_id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.state === "closed" ? " · Closed" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <Field name="Assignee">
            <select
              disabled={!can(i, "item", "update")}
              value={i.assignee_id || ""}
              onChange={(e) =>
                update({ assignee_id: e.target.value || null }).catch(() => {})
              }
            >
              <option value="">Unassigned</option>
              {i.assignee &&
                !users.data?.some((u) => u.id === i.assignee_id) && (
                  <option value={i.assignee.id}>
                    {i.assignee.display_name} · Inactive
                  </option>
                )}
              {users.data?.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.display_name}
                  {u.kind === "agent" ? " · Agent" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Priority">
            <select
              disabled={!can(i, "item", "update")}
              value={i.priority}
              onChange={(e) =>
                update({ priority: e.target.value }).catch(() => {})
              }
            >
              {priorities.map((s) => (
                <option value={s} key={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Labels">
            <select
              multiple
              disabled={!can(i, "item", "update")}
              value={i.label_ids}
              onChange={(e) =>
                update({
                  label_ids: [...e.target.selectedOptions].map((o) => o.value),
                }).catch(() => {})
              }
            >
              {labels.data?.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          {(can(i, "item", "create") ||
            can(i, "item", "update") ||
            can(i, "item", "delete")) && (
            <button
              className="btn ghost small"
              onClick={() => setLabelManager(true)}
            >
              Manage labels
            </button>
          )}
          <div className="small muted">
            Created {when(i.created_at)}
            <br />
            Updated {when(i.updated_at)}
          </div>
        </aside>
      </div>
      {navigation.state === "blocked" && (
        <Modal
          title="Leave without saving?"
          onClose={() => navigation.reset()}
          footer={
            <>
              <button className="btn" onClick={() => navigation.proceed()}>
                Discard changes
              </button>
              <button
                className="btn primary"
                onClick={() => navigation.reset()}
              >
                Keep editing
              </button>
            </>
          }
        >
          <p>
            The item description draft has not been saved. The saved record
            stays unchanged.
          </p>
        </Modal>
      )}
      {transition && (
        <StateDialog
          item={i}
          target={transition}
          onClose={() => setTransition(null)}
        />
      )}{" "}
      {move && (
        <MoveDialog
          items={[i]}
          reopen={move.reopen}
          onClose={() => setMove(null)}
        />
      )}{" "}
      {resume && <ResumeDialog item={i} onClose={() => setResume(false)} />}{" "}
      {addLink && <LinkDialog item={i} onClose={() => setAddLink(false)} />}{" "}
      {labelManager && (
        <LabelManager item={i} onClose={() => setLabelManager(false)} />
      )}
      {unlink && (
        <Modal
          title="Remove link?"
          onClose={() => setUnlink(null)}
          footer={
            <>
              <button className="btn" onClick={() => setUnlink(null)}>
                Keep link
              </button>
              <button
                className="btn danger"
                disabled={w.busy}
                onClick={() =>
                  w
                    .execute(() =>
                      api<{ automatic_state_changes: unknown[] }>(
                        `/items/${i.id}/links/${unlink.id}?item_version=${i.version}`,
                        { method: "DELETE", version: unlink.version },
                      ),
                    )
                    .then((result) => {
                      setUnlink(null);
                      w.setMessage(
                        result.automatic_state_changes.length
                          ? "All blockers removed — moved to Open."
                          : "Link removed.",
                      );
                    })
                    .catch(() => {})
                }
              >
                {unlink.relationship === "blocked_by" &&
                i.state === "blocked" &&
                i.blocker_summary.total === 1
                  ? "Remove blocker and move to Open"
                  : "Remove link"}
              </button>
            </>
          }
        >
          <p>
            Remove {unlink.item.key} as{" "}
            {label(unlink.relationship).toLowerCase()}?
          </p>
          {unlink.relationship === "blocked_by" &&
            i.state === "blocked" &&
            i.blocker_summary.total === 1 && (
              <div className="callout">
                This is the last blocker. This item will move to Open
                automatically.
              </div>
            )}
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete item?"
          subtitle={`${i.key} · ${i.title}`}
          onClose={() => setDeleting(null)}
          wide
          footer={
            <>
              <button className="btn" onClick={() => setDeleting(null)}>
                Keep item
              </button>
              <button
                className="btn danger"
                disabled={w.busy}
                onClick={() =>
                  w
                    .execute(() =>
                      api(
                        `/items/${i.id}?impact_revision=${deleting.impact_revision}`,
                        { method: "DELETE", version: deleting.version },
                      ),
                    )
                    .then(() => location.assign("/items"))
                    .catch(() => {})
                }
              >
                Delete item and its files/comments
              </button>
            </>
          }
        >
          <div className="stack">
            <p>
              This permanently removes the item, its comments and attachments.
              Linked items remain. The activity history is retained.
            </p>
            <ImpactList impact={deleting} />
            {!!w.error && <ErrorBox error={w.error} />}
          </div>
        </Modal>
      )}
    </>
  );
}

function LinkDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const [relationship, setRelationship] = useState("related");
  const [selected, setSelected] = useState<string[]>([]);
  const q = useCollection<Item>(
    ["link-candidates", item.project_id],
    "/items?" + query({ project_id: [item.project_id], limit: 200 }),
  );
  const w = useWrite();
  const candidates =
    q.data?.items.filter(
      (i) =>
        i.id !== item.id &&
        (relationship !== "blocked_by" || i.state !== "cancelled"),
    ) || [];
  async function save() {
    if (relationship === "blocked_by")
      await w.execute(() =>
        api(`/items/${item.id}`, {
          method: "PATCH",
          version: item.version,
          body: { blocked_by_item_ids: selected },
        }),
      );
    else {
      const target = candidates.find((i) => i.id === selected[0])!;
      await w.execute(() =>
        api(`/items/${item.id}/links`, {
          method: "POST",
          version: item.version,
          body: {
            relationship,
            target_item_id: target.id,
            expected_target_version: target.version,
          },
          key: crypto.randomUUID(),
        }),
      );
    }
    onClose();
  }
  return (
    <Modal
      title="Link items"
      subtitle={`${item.key} · ${item.title}`}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!selected.length || w.busy}
            onClick={() => save().catch(() => {})}
          >
            Add links
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}
        <Field name="This item is…">
          <select
            value={relationship}
            onChange={(e) => {
              setRelationship(e.target.value);
              setSelected([]);
            }}
          >
            {[
              ["related", "Related to"],
              ["parent", "Child of"],
              ["child", "Parent of"],
              ["blocked_by", "Blocked by"],
              ["blocks", "Blocks"],
            ].map(([v, t]) => (
              <option value={v} key={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <CandidatePicker
          items={candidates}
          selected={selected}
          onChange={(ids) =>
            setSelected(relationship === "blocked_by" ? ids : ids.slice(-1))
          }
        />
        <p className="small muted">
          Multiple blockers are allowed. One parent per item. Links can cross
          sprints within this project.
        </p>
      </div>
    </Modal>
  );
}

function LabelManager({ item, onClose }: { item: Item; onClose: () => void }) {
  const q = useData<Label[]>(
    ["labels", item.project_id],
    `/projects/${item.project_id}/labels`,
  );
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Label | null>(null);
  const w = useWrite();
  return (
    <Modal
      title="Project labels"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}{" "}
        {q.data?.map((l) => (
          <div className="between" key={l.id}>
            <span className="label">{l.name}</span>
            <div className="row">
              {can(item, "item", "update") && (
                <button
                  className="btn small ghost"
                  onClick={() => {
                    setEditing(l);
                    setName(l.name);
                  }}
                >
                  Rename
                </button>
              )}
              {can(item, "item", "delete") && (
                <button
                  className="btn small ghost danger-text"
                  onClick={async () => {
                    if (
                      await ask(
                        `Remove label ${l.name} from this project and all its items?`,
                      )
                    )
                      w.execute(() =>
                        api(`/projects/${item.project_id}/labels/${l.id}`, {
                          method: "DELETE",
                          version: l.version,
                        }),
                      ).catch(() => {});
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
        {(can(item, "item", "create") || editing) && (
          <>
            <Field name={editing ? "Rename label" : "New label"}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={300}
              />
            </Field>
            <div className="row">
              <button
                className="btn"
                disabled={!name.trim() || w.busy}
                onClick={() =>
                  w
                    .execute(() =>
                      api(
                        editing
                          ? `/projects/${item.project_id}/labels/${editing.id}`
                          : `/projects/${item.project_id}/labels`,
                        {
                          method: editing ? "PATCH" : "POST",
                          version: editing?.version,
                          body: { name },
                        },
                      ),
                    )
                    .then(() => {
                      setName("");
                      setEditing(null);
                    })
                    .catch(() => {})
                }
              >
                {editing ? "Save name" : "Add label"}
              </button>
              {editing && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    setName("");
                    setEditing(null);
                  }}
                >
                  Cancel rename
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function Comments({ item }: { item: Item }) {
  const [offset, setOffset] = useState(0);
  const q = useData<Page<Comment>>(
    ["comments", item.id, offset],
    `/items/${item.id}/comments?offset=${offset}`,
  );
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<Comment | null>(null);
  const w = useWrite();
  return (
    <>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          {q.data?.items.map((c) => (
            <div className="comment" key={c.id}>
              <span
                className={
                  "avatar " + (c.author.kind === "agent" ? "agent" : "")
                }
                aria-hidden
              >
                {c.author.display_name.slice(0, 2)}
              </span>
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{c.author.display_name}</strong>{" "}
                  {c.author.kind === "agent" && (
                    <span className="badge agent">Agent</span>
                  )}{" "}
                  · {when(c.created_at)}
                  {c.updated_at !== c.created_at && (
                    <> · Edited by {c.last_editor.display_name}</>
                  )}
                </div>
                {editing?.id === c.id ? (
                  <Field name="Edit comment">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                    />
                  </Field>
                ) : (
                  <div className="markdown">
                    <ReactMarkdown skipHtml>{c.body}</ReactMarkdown>
                  </div>
                )}
                <div className="row">
                  {can(item, "comment", "update") && (
                    <button
                      className="btn ghost small"
                      onClick={() => {
                        if (editing?.id === c.id) {
                          setEditing(null);
                          setBody("");
                        } else {
                          setEditing(c);
                          setBody(c.body);
                        }
                      }}
                    >
                      {editing?.id === c.id ? "Cancel edit" : "Edit"}
                    </button>
                  )}
                  {can(item, "comment", "delete") && (
                    <button
                      className="btn ghost small danger-text"
                      onClick={async () => {
                        if (await ask("Permanently remove this comment?"))
                          w.execute(() =>
                            api(`/items/${item.id}/comments/${c.id}`, {
                              method: "DELETE",
                              version: c.version,
                            }),
                          ).catch(() => {});
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {q.data && <Pagination data={q.data} onChange={setOffset} />}
        </>
      )}
      {!!w.error && <ErrorBox error={w.error} />}{" "}
      {(can(item, "comment", "create") || editing) && (
        <div className="stack">
          <Field name={editing ? "Edited comment" : "Add a comment"}>
            <textarea
              className="comment-compose"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
          </Field>
          <div>
            <button
              className="btn primary"
              disabled={!body.trim() || w.busy}
              onClick={() =>
                w
                  .execute(() =>
                    api(
                      editing
                        ? `/items/${item.id}/comments/${editing.id}`
                        : `/items/${item.id}/comments`,
                      {
                        method: editing ? "PATCH" : "POST",
                        version: editing?.version,
                        body: { body },
                        key: crypto.randomUUID(),
                      },
                    ),
                  )
                  .then(() => {
                    setBody("");
                    setEditing(null);
                  })
                  .catch(() => {})
              }
            >
              {editing ? "Save comment" : "Add comment"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Files({ item }: { item: Item }) {
  const [offset, setOffset] = useState(0);
  const q = useData<Page<Attachment>>(
    ["attachments", item.id, offset],
    `/items/${item.id}/attachments?offset=${offset}`,
  );
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    key: string;
  } | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const w = useWrite();
  async function upload(file: File, key: string = crypto.randomUUID()) {
    setPendingFile({ file, key });
    setProgress(0);
    setUploading(true);
    abort.current = new AbortController();
    try {
      await w.execute(() =>
        uploadAttachment(
          item.id,
          file,
          key,
          abort.current!.signal,
          setProgress,
        ),
      );
      setPendingFile(null);
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="section">
      <div className="section-head">
        <h2>Attachments</h2>
        {can(item, "attachment", "create") && (
          <label className="btn small">
            ↑ Upload file
            <input
              type="file"
              hidden
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.[0])
                  upload(e.target.files[0]).catch(() => {});
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {!!w.error && <ErrorBox error={w.error} />}{" "}
      {uploading && (
        <div role="status">
          <p>
            Uploading {pendingFile?.file.name} · {progress}%
          </p>
          <progress max={100} value={progress} />
          <button className="btn small" onClick={() => abort.current?.abort()}>
            Cancel upload
          </button>
        </div>
      )}
      {!uploading && pendingFile && (
        <button
          className="btn small"
          onClick={() =>
            upload(pendingFile.file, pendingFile.key).catch(() => {})
          }
        >
          Retry upload
        </button>
      )}
      <div className="row">
        {q.data?.items.map((a) => (
          <div className="attachment-tile" key={a.id}>
            <button className="file-open" onClick={() => setPreview(a)}>
              <span className="file-glyph">
                {a.preview_kind === "image"
                  ? "IMG"
                  : a.preview_kind === "text"
                    ? "TXT"
                    : "FILE"}
              </span>
              <strong className="small">{a.filename}</strong>
              <span className="small muted">{Math.ceil(a.size / 1024)} KB</span>
            </button>
            <div className="row">
              <a
                className="small"
                href={`/api/v1/attachments/${a.id}/content`}
                download
              >
                Download
              </a>
              {can(item, "attachment", "delete") && (
                <button
                  className="btn small ghost danger-text"
                  onClick={async () => {
                    if (await ask(`Permanently delete ${a.filename}?`))
                      w.execute(() =>
                        api(`/attachments/${a.id}`, {
                          method: "DELETE",
                          version: a.version,
                        }),
                      ).catch(() => {});
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {q.error && <ErrorBox error={q.error} />}{" "}
      {q.data && <Pagination data={q.data} onChange={setOffset} />}{" "}
      {preview && (
        <FilePreview attachment={preview} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}
function FilePreview({
  attachment: a,
  onClose,
}: {
  attachment: Attachment;
  onClose: () => void;
}) {
  const q = useData<{ text: string; truncated: boolean; size: number }>(
    ["file-preview", a.id],
    `/attachments/${a.id}/preview`,
    a.preview_kind === "text",
  );
  return (
    <Modal
      title={a.filename}
      subtitle={`${Math.ceil(a.size / 1024)} KB`}
      onClose={onClose}
      wide
      footer={
        <>
          <a
            className="btn"
            href={`/api/v1/attachments/${a.id}/content`}
            download
          >
            Download file
          </a>
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {a.preview_kind === "image" ? (
        <img
          className="actual-image"
          src={`/api/v1/attachments/${a.id}/preview`}
          alt={a.filename}
        />
      ) : a.preview_kind === "text" ? (
        q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorBox error={q.error} />
        ) : (
          <>
            <pre className="text-preview">{q.data?.text}</pre>
            {q.data?.truncated && (
              <p className="small muted">
                Preview truncated. Download the complete file.
              </p>
            )}
          </>
        )
      ) : (
        <Empty title="Preview is not available">
          Download this file to view it.
        </Empty>
      )}
    </Modal>
  );
}
