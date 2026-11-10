import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  can,
  label,
  query,
  states,
  types,
  priorities,
  type Impact,
  type Item,
  type Page,
  type Project,
  type Sprint,
  type Label,
  type User,
} from "./api/client";
import {
  ErrorBox,
  Field,
  Modal,
  Person,
  State,
  useCollection,
  useData,
  useWrite,
  useWorkspace,
} from "./ui";

export function ProjectEditor({
  project,
  onClose,
}: {
  project?: Project;
  onClose: () => void;
}) {
  const [name, setName] = useState(project?.name || "");
  const [key, setKey] = useState(project?.key || "");
  const [description, setDescription] = useState(project?.description || "");
  const w = useWrite();
  const nav = useNavigate();
  async function save() {
    const result = await w.execute(() =>
      api<Project>(project ? `/projects/${project.id}` : "/projects", {
        method: project ? "PATCH" : "POST",
        version: project?.version,
        body: project ? { name, description } : { name, key, description },
        key: crypto.randomUUID(),
      }),
    );
    onClose();
    nav("/projects/" + result.id);
  }
  return (
    <Modal
      title={project ? "Edit project" : "Create project"}
      onClose={onClose}
      dirty={
        name !== (project?.name || "") ||
        description !== (project?.description || "")
      }
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={w.busy || !name.trim() || (!project && !key.trim())}
            onClick={() => save().catch(() => {})}
          >
            {w.busy ? "Saving…" : project ? "Save changes" : "Create project"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}
        <Field name="Project name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={300}
          />
        </Field>
        <Field
          name="Project key"
          hint="Forms item keys, such as PLAN-1. It cannot change later."
        >
          <input
            value={key}
            disabled={!!project}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            maxLength={12}
          />
        </Field>
        <Field name="Description" hint="Markdown supported.">
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function SprintEditor({
  projectId,
  sprint,
  onClose,
}: {
  projectId: string;
  sprint?: Sprint;
  onClose: () => void;
}) {
  const [name, setName] = useState(sprint?.name || "");
  const w = useWrite();
  return (
    <Modal
      title={sprint ? "Rename sprint" : "Create sprint"}
      onClose={onClose}
      dirty={name !== (sprint?.name || "")}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim() || w.busy}
            onClick={() =>
              w
                .execute(() =>
                  api(
                    sprint
                      ? `/sprints/${sprint.id}`
                      : `/projects/${projectId}/sprints`,
                    {
                      method: sprint ? "PATCH" : "POST",
                      body: { name },
                      version: sprint?.version,
                      key: crypto.randomUUID(),
                    },
                  ),
                )
                .then(onClose)
                .catch(() => {})
            }
          >
            {w.busy ? "Saving…" : sprint ? "Save name" : "Create sprint"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}
        <Field name="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={300}
          />
        </Field>
        <p className="small muted">
          No dates are required. New sprints are not started and appear at the
          end of the order.
        </p>
      </div>
    </Modal>
  );
}

export function ItemEditor({
  projectId,
  sprintId,
  onClose,
}: {
  projectId: string;
  sprintId?: string;
  onClose: () => void;
}) {
  const { projects } = useWorkspace();
  const project = projects.find((p) => p.id === projectId);
  const [pid, setPid] = useState(projectId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [state, setState] = useState("open");
  const [priority, setPriority] = useState("none");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState(sprintId || "");
  const [labels, setLabels] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const w = useWrite();
  const nav = useNavigate();
  const selected = projects.find((p) => p.id === pid) || project;
  const sp = useCollection<Sprint>(
    ["sprints", pid],
    `/projects/${pid}/sprints?limit=200`,
    !!pid && can(selected, "sprint"),
  );
  const users = useData<User[]>(
    ["assignees", pid],
    `/projects/${pid}/assignees`,
    !!pid,
  );
  const ls = useData<Label[]>(
    ["labels", pid],
    `/projects/${pid}/labels`,
    !!pid,
  );
  const candidates = useCollection<Item>(
    ["block-candidates", pid],
    "/items?" + query({ project_id: [pid], limit: 200 }),
    state === "blocked" && !!pid,
  );
  async function save() {
    const result = await w.execute(() =>
      api<Item>(`/projects/${pid}/items`, {
        method: "POST",
        key: crypto.randomUUID(),
        body: {
          title,
          type,
          description,
          state,
          priority,
          assignee_id: assignee || null,
          sprint_id: sprint || null,
          label_ids: labels,
          blocked_by_item_ids: blockers,
        },
      }),
    );
    onClose();
    nav(`/projects/${pid}/items/${result.id}`);
  }
  return (
    <Modal
      title="Create item"
      onClose={onClose}
      wide
      dirty={!!title || !!description}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={
              w.busy ||
              !title.trim() ||
              !pid ||
              (state === "blocked" && !blockers.length)
            }
            onClick={() => save().catch(() => {})}
          >
            {w.busy ? "Creating…" : "Create and open"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}
        <Field name="Project">
          <select
            value={pid}
            onChange={(e) => {
              setPid(e.target.value);
              setSprint("");
              setLabels([]);
              setAssignee("");
              setBlockers([]);
            }}
          >
            {projects
              .filter((p) => can(p, "item", "create"))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field name="Type">
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="State">
            <select value={state} onChange={(e) => setState(e.target.value)}>
              {states.map((s) => (
                <option
                  key={s}
                  value={s}
                  disabled={s === "blocked" && !can(selected, "item", "update")}
                >
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field name="Title *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
          />
        </Field>
        <Field name="Description" hint="Markdown supported.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </Field>
        {state === "blocked" && (
          <div className="quiet-band">
            <h3>Blocked by · at least one required</h3>
            <CandidatePicker
              items={
                candidates.data?.items.filter((i) => i.state !== "cancelled") ||
                []
              }
              selected={blockers}
              onChange={setBlockers}
            />
          </div>
        )}
        <div className="two-fields">
          <Field name="Sprint">
            <select value={sprint} onChange={(e) => setSprint(e.target.value)}>
              <option value="">Backlog</option>
              {sp.data?.items
                .filter((s) => s.state !== "closed")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field name="Assignee">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Unassigned</option>
              {users.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                  {u.kind === "agent" ? " · Agent" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Priority">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {priorities.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Labels">
            <select
              multiple
              value={labels}
              onChange={(e) =>
                setLabels([...e.target.selectedOptions].map((o) => o.value))
              }
            >
              {ls.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function CandidatePicker({
  items,
  selected,
  onChange,
}: {
  items: Item[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [term, setTerm] = useState("");
  return (
    <>
      <Field name="Find items">
        <input
          type="search"
          value={term}
          placeholder="Key or title"
          onChange={(e) => setTerm(e.target.value)}
        />
      </Field>
      <div className="candidate-list">
        {items
          .filter((i) =>
            (i.key + " " + i.title).toLowerCase().includes(term.toLowerCase()),
          )
          .map((i) => (
            <label className="dependency-row" key={i.id}>
              <input
                type="checkbox"
                checked={selected.includes(i.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, i.id]
                      : selected.filter((id) => id !== i.id),
                  )
                }
              />
              <span className="grow">
                <span className="key">{i.key}</span> {i.title}
                <span className="small muted" style={{ display: "block" }}>
                  {i.sprint_name}
                </span>
              </span>
              <State state={i.state} />
            </label>
          ))}
      </div>
    </>
  );
}

export function MoveDialog({
  items,
  onClose,
  reopen,
}: {
  items: Item[];
  onClose: () => void;
  reopen?: string;
}) {
  const first = items[0];
  const [destination, setDestination] = useState("");
  const w = useWrite();
  const sp = useCollection<Sprint>(
    ["sprints", first.project_id],
    `/projects/${first.project_id}/sprints?limit=200`,
  );
  return (
    <Modal
      title={reopen ? "Move and reopen item" : "Move items"}
      subtitle={`${items.length} selected · same project`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={w.busy}
            onClick={() =>
              w
                .execute(
                  () =>
                    reopen
                      ? api(`/items/${first.id}`, {
                          method: "PATCH",
                          version: first.version,
                          body: {
                            sprint_id: destination || null,
                            state: reopen,
                          },
                        })
                      : api(`/projects/${first.project_id}/items/bulk-move`, {
                          method: "POST",
                          body: {
                            item_versions: Object.fromEntries(
                              items.map((i) => [i.id, i.version]),
                            ),
                            sprint_id: destination || null,
                          },
                          key: crypto.randomUUID(),
                        }),
                  "Items moved.",
                )
                .then(onClose)
                .catch(() => {})
            }
          >
            {reopen ? "Move and reopen" : "Move items"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}
        <Field name="Destination">
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">Backlog</option>
            {sp.data?.items
              .filter((s) => s.state !== "closed")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </Field>
        <p>
          {reopen
            ? `The item will change to ${label(reopen)} and move out of its closed sprint together.`
            : "Item states stay unchanged when moving."}
        </p>
      </div>
    </Modal>
  );
}

export function StateDialog({
  item,
  target,
  onClose,
}: {
  item: Item;
  target: string;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const w = useWrite();
  const candidates = useCollection<Item>(
    ["block-candidates", item.project_id],
    "/items?" + query({ project_id: [item.project_id], limit: 200 }),
    target === "blocked",
  );
  const impact = useData<Impact>(
    ["cancel-impact", item.id],
    `/items/${item.id}/cancellation-preview`,
    target === "cancelled",
  );
  const existing = item.blocker_summary.total;
  async function save() {
    await w.execute(() =>
      target === "blocked"
        ? api(`/items/${item.id}`, {
            method: "PATCH",
            version: item.version,
            body: { state: "blocked", blocked_by_item_ids: chosen },
          })
        : api(`/items/${item.id}/cancel`, {
            method: "POST",
            body: {
              expected_version: impact.data!.version,
              impact_revision: impact.data!.impact_revision,
              confirm_blocker_removal: true,
            },
            key: crypto.randomUUID(),
          }),
    );
    onClose();
  }
  return (
    <Modal
      title={
        target === "blocked"
          ? "Move item to Blocked"
          : impact.data?.affected_items.length
            ? "Cancel item and remove blocker links?"
            : "Cancel item?"
      }
      subtitle={`${item.key} · ${item.title}`}
      onClose={onClose}
      wide={target === "blocked" || !!impact.data?.affected_items.length}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Keep item unchanged
          </button>
          <button
            className={"btn " + (target === "cancelled" ? "danger" : "primary")}
            disabled={
              w.busy ||
              (target === "blocked" && !existing && !chosen.length) ||
              (target === "cancelled" && !impact.data)
            }
            onClick={() => save().catch(() => {})}
          >
            {target === "blocked"
              ? "Add blockers and move to Blocked"
              : impact.data?.affected_items.length
                ? "Cancel item and remove links"
                : "Cancel item"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}{" "}
        {target === "blocked" ? (
          <>
            <p>
              {existing
                ? `${existing} existing blocker links already satisfy the requirement. You can add more.`
                : "Choose at least one item blocking this work."}
            </p>
            <CandidatePicker
              items={
                candidates.data?.items.filter(
                  (i) => i.id !== item.id && i.state !== "cancelled",
                ) || []
              }
              selected={chosen}
              onChange={setChosen}
            />
          </>
        ) : (
          <>
            <p>
              Cancelling {item.key}
              {impact.data?.affected_items.length
                ? " will remove it as a blocker for these items. Continue?"
                : " marks this work as no longer pursued."}
            </p>
            {impact.error && (
              <ErrorBox error={impact.error} retry={() => impact.refetch()} />
            )}
            <ImpactList impact={impact.data} />
            <p className="small muted">
              Cancellation, blocker-link removal and automatic Open transitions
              happen together. Other links and dependent items remain.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ImpactList({ impact }: { impact?: Impact }) {
  return impact?.affected_items.length ? (
    <div className="impact-list">
      {impact.affected_items.map((a) => (
        <div className="dependency-row" key={a.link_id}>
          <div className="grow">
            <strong>
              {a.item.key} · {a.item.title}
            </strong>
            <div className="small muted">
              {a.remaining_blockers} blocker links will remain
            </div>
          </div>
          <span className={"outcome " + (a.will_move_to_open ? "open" : "")}>
            {a.will_move_to_open
              ? "Moves to Open"
              : a.item.state === "blocked"
                ? "Remains Blocked"
                : `Remains ${label(a.item.state)}`}
          </span>
        </div>
      ))}
    </div>
  ) : null;
}

export function ResumeDialog({
  item,
  onClose,
}: {
  item: Item;
  onClose: () => void;
}) {
  const w = useWrite();
  return (
    <Modal
      title="All blockers are Done"
      subtitle={`${item.key} · ${item.title}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Not now
          </button>
          <button
            className="btn primary"
            disabled={w.busy}
            onClick={() =>
              w
                .execute(
                  () =>
                    api(`/items/${item.id}/resume`, {
                      method: "POST",
                      body: {
                        expected_version: item.version,
                        blocker_revision: item.blocker_summary.blocker_revision,
                      },
                      key: crypto.randomUUID(),
                    }),
                  "Moved to In progress.",
                )
                .then(onClose)
                .catch(() => {})
            }
          >
            Move to In progress
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}
        <p>
          All {item.blocker_summary.total} blockers are Done. Move this item
          from Blocked to In progress?
        </p>
        <p className="small muted">
          Not now keeps the item Blocked. You will be asked again the next time
          you open it.
        </p>
      </div>
    </Modal>
  );
}

export function CloseSprint({
  sprint,
  onClose,
}: {
  sprint: Sprint;
  onClose: () => void;
}) {
  const [destination, setDestination] = useState("");
  const w = useWrite();
  const q = useData<{
    sprint: Sprint;
    unfinished: Item[];
    destinations: Sprint[];
  }>(["close-preview", sprint.id], `/sprints/${sprint.id}/close-preview`);
  const dest = q.data?.destinations.find((s) => s.id === destination);
  const needs = !!q.data?.unfinished.length;
  return (
    <Modal
      title="Close sprint"
      subtitle={sprint.name}
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Keep sprint active
          </button>
          <button
            className="btn primary"
            disabled={w.busy || !q.data || (needs && !dest)}
            onClick={() =>
              w
                .execute(() =>
                  api(`/sprints/${sprint.id}/close`, {
                    method: "POST",
                    body: {
                      expected_version: q.data!.sprint.version,
                      move_unfinished_to_sprint_id: needs ? dest!.id : null,
                      destination_version: needs ? dest!.version : null,
                    },
                    key: crypto.randomUUID(),
                  }),
                )
                .then(onClose)
                .catch(() => {})
            }
          >
            {needs
              ? `Move ${q.data?.unfinished.length} items and close`
              : "Close sprint"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}{" "}
        {q.error && <ErrorBox error={q.error} retry={() => q.refetch()} />}
        <div className="row">
          <span className="quiet-band">
            {q.data?.sprint.counts?.done || 0} Done
          </span>
          <span className="quiet-band">
            {q.data?.sprint.counts?.cancelled || 0} Cancelled
          </span>
          <span className="quiet-band">
            {q.data?.unfinished.length || 0} Unfinished
          </span>
        </div>
        {needs ? (
          <>
            <p>
              Move unfinished work to another sprint. Item states will be
              preserved.
            </p>
            <div className="candidate-list">
              {q.data?.unfinished.map((i) => (
                <div className="dependency-row" key={i.id}>
                  <span className="grow">
                    {i.key} · {i.title}
                  </span>
                  <State state={i.state} />
                </div>
              ))}
            </div>
            <Field name="Move unfinished work to">
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Choose another sprint</option>
                {q.data?.destinations.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            {!q.data?.destinations.length && (
              <p className="danger-text">
                Create another sprint in Planning before closing.
              </p>
            )}
          </>
        ) : (
          <p>
            All remaining items are Done or Cancelled. This sprint can close.
          </p>
        )}
        <p className="small muted">
          Closing is final. The closure time is recorded automatically.
        </p>
      </div>
    </Modal>
  );
}
