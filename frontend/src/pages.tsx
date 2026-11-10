import { ask } from "./ui";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  api,
  can,
  label,
  priorities,
  query,
  reorderItem,
  states,
  types,
  when,
  type Item,
  type Page,
  type Project,
  type Sprint,
} from "./api/client";
import {
  Activity,
  BlockerBadge,
  Empty,
  ErrorBox,
  Heading,
  ItemLink,
  ItemTable,
  Loading,
  Pagination,
  State,
  useCollection,
  useData,
  useWorkspace,
  useWrite,
} from "./ui";
import {
  CloseSprint,
  ItemEditor,
  MoveDialog,
  ProjectEditor,
  SprintEditor,
  StateDialog,
} from "./dialogs";

export function Home() {
  const q = useData<{
    projects: (Project & {
      active_sprint: Sprint | null;
      counts?: Record<string, number>;
    })[];
    assigned: Page<Item>;
    ready: Page<Item>;
  }>(["home"], "/home");
  const { user } = useWorkspace();
  const [create, setCreate] = useState(false);
  return (
    <>
      <Heading
        title="Home"
        description="A clear view of your projects and current work."
        actions={
          user.is_admin && (
            <button className="btn primary" onClick={() => setCreate(true)}>
              + New project
            </button>
          )
        }
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.projects.length ? (
        <Empty
          title={
            user.is_admin
              ? "Start with a project"
              : "No projects shared with you"
          }
        >
          {user.is_admin ? (
            <button className="btn primary" onClick={() => setCreate(true)}>
              Create project
            </button>
          ) : (
            "An administrator can grant you project access."
          )}
        </Empty>
      ) : (
        <>
          <div className="section-head">
            <h2>
              Projects <span className="count">{q.data.projects.length}</span>
            </h2>
          </div>
          <div className="panel flush">
            {q.data.projects.map((p) => (
              <div className="project-row" key={p.id}>
                <div className="row">
                  <span className="project-key">{p.key.slice(0, 2)}</span>
                  <div>
                    <Link className="project-name" to={"/projects/" + p.id}>
                      {p.name}
                    </Link>
                    <div className="key">{p.key}</div>
                  </div>
                </div>
                <div>
                  {p.active_sprint ? (
                    <Link
                      to={`/projects/${p.id}/sprints/${p.active_sprint.id}`}
                    >
                      {p.active_sprint.name}
                    </Link>
                  ) : (
                    <span className="muted">No active sprint</span>
                  )}
                </div>
                {p.counts && (
                  <div className="mini-stats">
                    {p.counts.done} done · {p.counts.cancelled} cancelled
                  </div>
                )}
                <Link to={"/projects/" + p.id}>Open →</Link>
              </div>
            ))}
          </div>
          <section className="section">
            <div className="section-head">
              <h2>Assigned to you</h2>
              <Link to={"/items?assignee_id=" + user.id}>View all →</Link>
            </div>
            <ItemTable data={q.data.assigned} />
          </section>
          {q.data.ready.total > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>Ready to resume</h2>
                <Link to="/items?ready_to_resume=true">View all →</Link>
              </div>
              <ItemTable data={q.data.ready} />
            </section>
          )}
        </>
      )}
      {create && <ProjectEditor onClose={() => setCreate(false)} />}
    </>
  );
}

export function ProjectOverview() {
  const { id } = useParams();
  const q = useData<Project>(["project", id], `/projects/${id}`);
  const sp = useCollection<Sprint>(
    ["sprints", id],
    `/projects/${id}/sprints?limit=200`,
    can(q.data, "sprint"),
  );
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState("overview");
  const w = useWrite();
  const { user } = useWorkspace();
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const p = q.data!;
  return (
    <>
      <Heading
        title={p.name}
        description={p.key}
        actions={
          <>
            {can(p, "project", "update") && (
              <button className="btn" onClick={() => setEdit(true)}>
                Edit project
              </button>
            )}
            {user.is_admin && (
              <button
                className="btn ghost danger-text"
                onClick={async () => {
                  if (
                    await ask(
                      `Delete the empty project ${p.name}? This cannot be undone.`,
                    )
                  )
                    w.execute(() =>
                      api(`/projects/${p.id}`, {
                        method: "DELETE",
                        version: p.version,
                      }),
                    )
                      .then(() => location.assign("/"))
                      .catch(() => {});
                }}
              >
                Delete project
              </button>
            )}
          </>
        }
      />
      {!!w.error && <ErrorBox error={w.error} />}
      <div className="tabs">
        <button
          className={"tab " + (tab === "overview" ? "active" : "")}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={"tab " + (tab === "activity" ? "active" : "")}
          onClick={() => setTab("activity")}
        >
          Activity
        </button>
      </div>
      {tab === "activity" ? (
        <Activity projectId={p.id} />
      ) : (
        <>
          <section className="panel">
            <h2>About this project</h2>
            <div className="prose markdown">
              <ReactMarkdown>
                {p.description || "No description yet."}
              </ReactMarkdown>
            </div>
            <div className="row">
              <Link className="btn primary" to={`/projects/${p.id}/planning`}>
                Open Planning
              </Link>
              <Link className="btn" to={"/items?project_id=" + p.id}>
                View items
              </Link>
              {user.is_admin && (
                <Link
                  className="btn ghost"
                  to={`/projects/${p.id}/settings/permissions`}
                >
                  Manage permissions
                </Link>
              )}
            </div>
          </section>
          <section className="section">
            <h2>Sprints</h2>
            {sp.data?.items.length ? (
              <div className="stack" style={{ marginTop: 16 }}>
                {sp.data.items.map((s) => (
                  <div className="panel between" key={s.id}>
                    <div>
                      <Link to={`/projects/${p.id}/sprints/${s.id}`}>
                        <strong>{s.name}</strong>
                      </Link>
                      <div className="small muted">
                        {label(s.state)}
                        {s.started_at ? " · Started " + when(s.started_at) : ""}
                      </div>
                    </div>
                    {s.counts && (
                      <span className="small muted">
                        {s.counts.done} Done · {s.counts.cancelled} Cancelled
                      </span>
                    )}
                  </div>
                ))}
                {sp.data.total > sp.data.items.length && (
                  <Link to={`/projects/${p.id}/planning`}>
                    More sprints in Planning →
                  </Link>
                )}
              </div>
            ) : (
              <Empty title="No sprints yet">
                <Link to={`/projects/${p.id}/planning`}>
                  Plan your first sprint
                </Link>
              </Empty>
            )}
          </section>
        </>
      )}
      {edit && <ProjectEditor project={p} onClose={() => setEdit(false)} />}
    </>
  );
}

function SprintSection({
  sprint,
  selected,
  onSelect,
  onEdit,
  onCloseSprint,
  onStart,
  onMove,
  onCreate,
}: {
  sprint: Sprint;
  selected: Set<string>;
  onSelect: (i: Item) => void;
  onEdit: () => void;
  onCloseSprint: () => void;
  onStart: () => void;
  onMove: (i: Item) => void;
  onCreate: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const q = useData<Page<Item>>(
    ["sprint-items", sprint.id, offset],
    "/items?" +
      query({
        project_id: [sprint.project_id],
        sprint_id: [sprint.id],
        sort: "rank",
        direction: "asc",
        offset,
      }),
    true,
  );
  const { project } = useWorkspace();
  const w = useWrite();
  return (
    <section className="sprint-section">
      <div
        className={
          "sprint-section-head " + (sprint.state === "active" ? "active" : "")
        }
      >
        <div>
          <h2>
            <Link to={`/projects/${sprint.project_id}/sprints/${sprint.id}`}>
              {sprint.name}
            </Link>
          </h2>
          <span className="small muted">
            {label(sprint.state)} · {sprint.total ?? q.data?.total ?? 0} items
          </span>
        </div>
        <div className="row">
          {can(project, "sprint", "update") && (
            <>
              <button className="btn small ghost" onClick={onEdit}>
                Rename
              </button>
              {sprint.state !== "closed" && (
                <button
                  className="btn small"
                  onClick={sprint.state === "active" ? onCloseSprint : onStart}
                >
                  {sprint.state === "active" ? "Close sprint" : "Start sprint"}
                </button>
              )}
            </>
          )}
          {sprint.state === "planned" && can(project, "sprint", "delete") && (
            <button
              className="btn ghost small danger-text"
              onClick={async () => {
                if (
                  await ask(
                    "Delete " +
                      sprint.name +
                      "? Only empty, not-started sprints can be removed.",
                  )
                )
                  w.execute(() =>
                    api(`/sprints/${sprint.id}`, {
                      method: "DELETE",
                      version: sprint.version,
                    }),
                  ).catch(() => {});
              }}
            >
              Delete
            </button>
          )}
          {sprint.state !== "closed" && can(project, "item", "create") && (
            <button className="btn small ghost" onClick={onCreate}>
              + Item
            </button>
          )}
        </div>
      </div>
      {!!w.error && <ErrorBox error={w.error} />}{" "}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          <ItemTable
            data={q.data!}
            selected={selected}
            onSelect={can(project, "item", "update") ? onSelect : undefined}
            onState={
              can(project, "item", "update")
                ? (i) => (
                    <div className="row">
                      <button
                        className="btn small ghost"
                        onClick={() => onMove(i)}
                      >
                        Move
                      </button>
                      {sprint.state !== "closed" && (
                        <>
                          <button
                            className="btn small ghost"
                            aria-label={"Move " + i.key + " up"}
                            onClick={() =>
                              w
                                .execute(() => reorderItem(i, -1))
                                .catch(() => {})
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="btn small ghost"
                            aria-label={"Move " + i.key + " down"}
                            onClick={() =>
                              w.execute(() => reorderItem(i, 1)).catch(() => {})
                            }
                          >
                            ↓
                          </button>
                        </>
                      )}
                    </div>
                  )
                : undefined
            }
          />
          <Pagination data={q.data!} onChange={setOffset} />
        </>
      )}
    </section>
  );
}

export function Planning() {
  const { id } = useParams();
  const { project } = useWorkspace();
  const [offset, setOffset] = useState(0);
  const [sprintOffset, setSprintOffset] = useState(0);
  const [edit, setEdit] = useState<Sprint | "new" | null>(null);
  const [close, setClose] = useState<Sprint | null>(null);
  const [create, setCreate] = useState<string | undefined | null>(null);
  const [moving, setMoving] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState<Record<string, Item>>({});
  const w = useWrite();
  const back = useData<Page<Item>>(
    ["backlog", id, offset],
    "/items?" +
      query({
        project_id: [id],
        backlog: true,
        sort: "rank",
        direction: "asc",
        offset,
      }),
    can(project, "item"),
  );
  const sp = useData<Page<Sprint>>(
    ["planning-sprints", id, sprintOffset],
    `/projects/${id}/sprints?offset=${sprintOffset}`,
    can(project, "sprint"),
  );
  function toggle(i: Item) {
    setSelected((s) => {
      const next = { ...s };
      if (next[i.id]) delete next[i.id];
      else next[i.id] = i;
      return next;
    });
  }
  async function start(s: Sprint) {
    if (await ask(`Start ${s.name}? This becomes the project's active sprint.`))
      await w.execute(() =>
        api(`/sprints/${s.id}/start`, {
          method: "POST",
          body: { expected_version: s.version },
          key: crypto.randomUUID(),
        }),
      );
  }
  async function reorder(index: number, delta: number) {
    if (!sp.data || sp.data.total !== sp.data.items.length) return;
    const all = [...sp.data.items];
    [all[index], all[index + delta]] = [all[index + delta], all[index]];
    await w.execute(() =>
      api(`/projects/${id}/sprint-order`, {
        method: "PUT",
        body: {
          ordered_ids: all.map((s) => s.id),
          versions: Object.fromEntries(all.map((s) => [s.id, s.version])),
        },
      }),
    );
  }
  return (
    <>
      <Heading
        title="Planning"
        description="Move work into sprints. Item states stay as they are."
        actions={
          can(project, "sprint", "create") && (
            <button className="btn primary" onClick={() => setEdit("new")}>
              + New sprint
            </button>
          )
        }
      />
      {!!w.error && <ErrorBox error={w.error} />}{" "}
      {!!Object.keys(selected).length && (
        <div className="quiet-band between">
          <strong>{Object.keys(selected).length} items selected</strong>
          <div className="row">
            <button
              className="btn primary"
              onClick={() => setMoving(Object.values(selected))}
            >
              Move selected
            </button>
            <button className="btn ghost" onClick={() => setSelected({})}>
              Clear
            </button>
          </div>
        </div>
      )}
      <div className="planning-layout section">
        <section
          className="panel"
          onDragOver={(e) => {
            if (can(project, "item", "update")) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const moved = JSON.parse(e.dataTransfer.getData("text/plain"));
              w.execute(() =>
                api(`/projects/${id}/items/bulk-move`, {
                  method: "POST",
                  body: {
                    item_versions: { [moved.id]: moved.version },
                    sprint_id: null,
                  },
                }),
              ).catch(() => {});
            } catch {}
          }}
        >
          <div className="section-head">
            <h2>
              Backlog <span className="count">{back.data?.total ?? 0}</span>
            </h2>
            {can(project, "item", "create") && (
              <button
                className="btn small ghost"
                onClick={() => setCreate(undefined)}
              >
                + Add
              </button>
            )}
          </div>
          {back.error ? (
            <ErrorBox error={back.error} />
          ) : back.isPending ? (
            can(project, "item") ? (
              <Loading />
            ) : (
              <p className="muted">Item view access is required.</p>
            )
          ) : (
            back.data?.items.map((i) => (
              <div
                className="planning-item"
                key={i.id}
                draggable={can(project, "item", "update")}
                onDragStart={(e) =>
                  e.dataTransfer.setData(
                    "text/plain",
                    JSON.stringify({ id: i.id, version: i.version }),
                  )
                }
              >
                <div className="row">
                  {can(project, "item", "update") && (
                    <input
                      type="checkbox"
                      aria-label={"Select " + i.key}
                      checked={!!selected[i.id]}
                      onChange={() => toggle(i)}
                    />
                  )}
                  <span className="key">{i.key}</span>
                </div>
                <h3>
                  <ItemLink item={i} />
                </h3>
                <State state={i.state} />
                <BlockerBadge item={i} />
                {can(project, "item", "update") && (
                  <span className="row">
                    <button
                      className="btn small ghost"
                      onClick={() => setMoving([i])}
                    >
                      Move
                    </button>
                    <button
                      className="btn ghost small"
                      aria-label={"Move " + i.key + " up"}
                      onClick={() =>
                        w.execute(() => reorderItem(i, -1)).catch(() => {})
                      }
                    >
                      ↑
                    </button>
                    <button
                      className="btn ghost small"
                      aria-label={"Move " + i.key + " down"}
                      onClick={() =>
                        w.execute(() => reorderItem(i, 1)).catch(() => {})
                      }
                    >
                      ↓
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
          {back.data && <Pagination data={back.data} onChange={setOffset} />}
        </section>
        <div className="stack">
          {sp.isPending ? (
            can(project, "sprint") ? (
              <Loading />
            ) : (
              <Empty title="Sprint access required" />
            )
          ) : sp.error ? (
            <ErrorBox error={sp.error} />
          ) : sp.data?.items.length ? (
            sp.data.items.map((s, n) => (
              <div
                key={s.id}
                onDragOver={(e) => {
                  if (s.state !== "closed" && can(project, "item", "update"))
                    e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (s.state === "closed") return;
                  try {
                    const i = JSON.parse(e.dataTransfer.getData("text/plain"));
                    w.execute(() =>
                      api(`/projects/${id}/items/bulk-move`, {
                        method: "POST",
                        body: {
                          item_versions: { [i.id]: i.version },
                          sprint_id: s.id,
                        },
                      }),
                    ).catch(() => {});
                  } catch {}
                }}
              >
                <SprintSection
                  sprint={s}
                  selected={new Set(Object.keys(selected))}
                  onSelect={toggle}
                  onEdit={() => setEdit(s)}
                  onCloseSprint={() => setClose(s)}
                  onStart={() => start(s).catch(() => {})}
                  onMove={(i) => setMoving([i])}
                  onCreate={() => setCreate(s.id)}
                />
                {can(project, "sprint", "update") &&
                  sp.data.total === sp.data.items.length && (
                    <div className="row">
                      <button
                        className="btn ghost small"
                        disabled={!n}
                        onClick={() => reorder(n, -1).catch(() => {})}
                      >
                        Move sprint up
                      </button>
                      <button
                        className="btn ghost small"
                        disabled={n === sp.data!.items.length - 1}
                        onClick={() => reorder(n, 1).catch(() => {})}
                      >
                        Move sprint down
                      </button>
                    </div>
                  )}
              </div>
            ))
          ) : (
            <Empty title="No sprints yet">
              Create a sprint to group the next work.
            </Empty>
          )}
          {sp.data && <Pagination data={sp.data} onChange={setSprintOffset} />}
        </div>
      </div>
      {edit && (
        <SprintEditor
          projectId={id!}
          sprint={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}{" "}
      {close && <CloseSprint sprint={close} onClose={() => setClose(null)} />}{" "}
      {create !== null && (
        <ItemEditor
          projectId={id!}
          sprintId={create}
          onClose={() => setCreate(null)}
        />
      )}{" "}
      {moving && (
        <MoveDialog
          items={moving}
          onClose={() => {
            setMoving(null);
            setSelected({});
          }}
        />
      )}
    </>
  );
}

export function ItemList() {
  const [params, setParams] = useSearchParams();
  const { projects, project } = useWorkspace();
  const [create, setCreate] = useState(false);
  const [filters, setFilters] = useState(false);
  const [columns, setColumns] = useState(false);
  const [extra, setExtra] = useState(true);
  const [moving, setMoving] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState<Record<string, Item>>({});
  const q = useData<Page<Item>>(
    ["items", params.toString()],
    "/items?" + params.toString(),
  );
  function filter(key: string, values: string[]) {
    const p = new URLSearchParams(params);
    p.delete(key);
    values.filter(Boolean).forEach((v) => p.append(key, v));
    p.delete("offset");
    setParams(p);
  }
  const selectedProject = projects.find(
    (p) => p.id === (params.get("project_id") || project?.id),
  );
  const ls = useData<Label[]>(
    ["labels", selectedProject?.id],
    `/projects/${selectedProject?.id}/labels`,
    !!selectedProject && can(selectedProject, "item"),
  );
  const users = useData<User[]>(
    ["assignees", selectedProject?.id],
    `/projects/${selectedProject?.id}/assignees`,
    !!selectedProject && can(selectedProject, "item"),
  );
  const sp = useCollection<Sprint>(
    ["sprints", selectedProject?.id],
    `/projects/${selectedProject?.id}/sprints?limit=200`,
    !!selectedProject && can(selectedProject, "sprint"),
  );
  return (
    <>
      <Heading
        title="Items"
        description="Find work across projects you can access."
        actions={
          can(selectedProject, "item", "create") && (
            <button className="btn primary" onClick={() => setCreate(true)}>
              + Create item
            </button>
          )
        }
      />
      <div className="filters">
        <input
          className="filter-input"
          type="search"
          aria-label="Search items"
          placeholder="Search title, key or description"
          value={params.get("q") || ""}
          onChange={(e) => filter("q", [e.target.value])}
        />
        <button className="filter-chip" onClick={() => setFilters(!filters)}>
          Filters {params.size > 0 && `(${params.size})`} ⌄
        </button>
        <button
          className="btn ghost small"
          onClick={() => setColumns(!columns)}
        >
          Columns
        </button>
        {params.size > 0 && (
          <button className="btn ghost small" onClick={() => setParams({})}>
            Clear all
          </button>
        )}
      </div>
      {columns && (
        <div className="quiet-band">
          <label className="check">
            <input
              type="checkbox"
              checked={extra}
              onChange={(e) => setExtra(e.target.checked)}
            />
            Show sprint, labels and update time
          </label>
        </div>
      )}
      {filters && (
        <div className="panel stack">
          <div className="two-fields">
            <Multi
              name="Projects"
              value={params.getAll("project_id")}
              options={projects.map((p) => [p.id, p.name])}
              onChange={(v) => filter("project_id", v)}
            />
            <Multi
              name="Types"
              value={params.getAll("type")}
              options={types.map((t) => [t, label(t)])}
              onChange={(v) => filter("type", v)}
            />
            <Multi
              name="States"
              value={params.getAll("state")}
              options={states.map((t) => [t, label(t)])}
              onChange={(v) => filter("state", v)}
            />
            <Multi
              name="Priorities"
              value={params.getAll("priority")}
              options={priorities.map((t) => [t, label(t)])}
              onChange={(v) => filter("priority", v)}
            />
            <Multi
              name="Sprints"
              value={params.getAll("sprint_id")}
              options={sp.data?.items.map((t) => [t.id, t.name]) || []}
              onChange={(v) => filter("sprint_id", v)}
            />
            <Multi
              name="Assignees"
              value={params.getAll("assignee_id")}
              options={users.data?.map((t) => [t.id, t.display_name]) || []}
              onChange={(v) => filter("assignee_id", v)}
            />
            <Multi
              name="Labels (match all)"
              value={params.getAll("label_id")}
              options={ls.data?.map((t) => [t.id, t.name]) || []}
              onChange={(v) => filter("label_id", v)}
            />
            <label className="field">
              <span>Updated since</span>
              <input
                type="date"
                value={params.get("updated_since")?.slice(0, 10) || ""}
                onChange={(e) =>
                  filter(
                    "updated_since",
                    e.target.value
                      ? [new Date(e.target.value).toISOString()]
                      : [],
                  )
                }
              />
            </label>
            <label className="field">
              <span>Sort</span>
              <select
                value={params.get("sort") || "updated_at"}
                onChange={(e) => filter("sort", [e.target.value])}
              >
                {[
                  "key",
                  "title",
                  "priority",
                  "state",
                  "created_at",
                  "updated_at",
                ].map((t) => (
                  <option value={t} key={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Direction</span>
              <select
                value={params.get("direction") || "desc"}
                onChange={(e) => filter("direction", [e.target.value])}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
          <div className="row">
            {[
              ["backlog", "Include Backlog"],
              ["unassigned", "Include Unassigned"],
              ["ready_to_resume", "Ready to resume only"],
            ].map(([key, name]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={params.get(key) === "true"}
                  onChange={(e) =>
                    filter(key, e.target.checked ? ["true"] : [])
                  }
                />
                {name}
              </label>
            ))}
          </div>
          <p className="small muted">
            Match all filter groups. Selected labels must all match; values
            within other groups match any selection. Filters are saved in this
            page's URL.
          </p>
        </div>
      )}
      {!!Object.keys(selected).length && (
        <div className="quiet-band between">
          <span>{Object.keys(selected).length} selected</span>
          <button
            className="btn"
            disabled={
              new Set(Object.values(selected).map((i) => i.project_id)).size !==
              1
            }
            onClick={() => setMoving(Object.values(selected))}
          >
            Move selected
          </button>
          <button className="btn ghost" onClick={() => setSelected({})}>
            Clear selection
          </button>
        </div>
      )}
      <div className="section">
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorBox error={q.error} retry={() => q.refetch()} />
        ) : (
          <>
            <ItemTable
              data={q.data!}
              extra={extra}
              selected={new Set(Object.keys(selected))}
              onSelect={(i) => {
                if (!can(i, "item", "update")) return;
                setSelected((s) => {
                  const n = { ...s };
                  if (n[i.id]) delete n[i.id];
                  else n[i.id] = i;
                  return n;
                });
              }}
            />
            <Pagination
              data={q.data!}
              onChange={(o) => {
                const p = new URLSearchParams(params);
                p.set("offset", String(o));
                setParams(p);
              }}
            />
          </>
        )}
      </div>
      {create && (
        <ItemEditor
          projectId={selectedProject!.id}
          onClose={() => setCreate(false)}
        />
      )}{" "}
      {moving && (
        <MoveDialog
          items={moving}
          onClose={() => {
            setMoving(null);
            setSelected({});
          }}
        />
      )}
    </>
  );
}

import type { Label, User } from "./api/client";
function Multi({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string[];
  options: string[][];
  onChange: (v: string[]) => void;
}) {
  return (
    <label className="field">
      <span>{name}</span>
      <select
        multiple
        value={value}
        onChange={(e) =>
          onChange([...e.target.selectedOptions].map((o) => o.value))
        }
      >
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SprintBoard() {
  const { id, sprintId } = useParams();
  const { project } = useWorkspace();
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const q = useData<{ sprint: Sprint; columns: Record<string, Page<Item>> }>(
    ["board", sprintId, offsets],
    `/sprints/${sprintId}/board?` +
      query(
        Object.fromEntries(
          Object.entries(offsets).map(([k, v]) => [k + "_offset", v]),
        ),
      ),
  );
  const sp = useCollection<Sprint>(
    ["sprints", id],
    `/projects/${id}/sprints?limit=200`,
  );
  const [transition, setTransition] = useState<{
    item: Item;
    target: string;
  } | null>(null);
  const [moving, setMoving] = useState<Item | null>(null);
  const [close, setClose] = useState(false);
  const [create, setCreate] = useState(false);
  const w = useWrite();
  const nav = useNavigate();
  async function change(i: Item, state: string) {
    if (state === i.state) return;
    if (i.sprint_state === "closed") {
      setMoving(i);
      return;
    }
    if (state === "blocked" || state === "cancelled") {
      setTransition({ item: i, target: state });
      return;
    }
    await w.execute(() =>
      api(`/items/${i.id}`, {
        method: "PATCH",
        body: { state },
        version: i.version,
      }),
    );
  }
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const sprint = q.data!.sprint;
  return (
    <>
      <Heading
        title={sprint.name}
        description={
          <>
            {label(sprint.state)}
            {sprint.started_at ? " · Started " + when(sprint.started_at) : ""}
            {sprint.closed_at ? " · Closed " + when(sprint.closed_at) : ""}
          </>
        }
        actions={
          <>
            <select
              className="btn"
              aria-label="Choose sprint"
              value={sprint.id}
              onChange={(e) => nav(`/projects/${id}/sprints/${e.target.value}`)}
            >
              {sp.data?.items.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {can(project, "sprint", "update") && sprint.state === "active" && (
              <button className="btn primary" onClick={() => setClose(true)}>
                Close sprint
              </button>
            )}
            {can(project, "sprint", "update") && sprint.state === "planned" && (
              <button
                className="btn primary"
                onClick={async () => {
                  if (await ask("Start " + sprint.name + "?"))
                    w.execute(() =>
                      api(`/sprints/${sprint.id}/start`, {
                        method: "POST",
                        body: { expected_version: sprint.version },
                      }),
                    ).catch(() => {});
                }}
              >
                Start sprint
              </button>
            )}
          </>
        }
      />
      {!!w.error && <ErrorBox error={w.error} />}{" "}
      {sprint.state === "closed" && (
        <div className="callout">
          This sprint is closed. Move an item out before changing its state.
        </div>
      )}
      <div className="between section">
        <span className="small muted">
          {sprint.total} items · {sprint.counts?.done || 0} Done ·{" "}
          {sprint.counts?.cancelled || 0} Cancelled
        </span>
        {sprint.state !== "closed" && can(project, "item", "create") && (
          <button className="btn small" onClick={() => setCreate(true)}>
            + Create item
          </button>
        )}
      </div>
      <div className="board-scroll section">
        <div className="board">
          {states.map((state) => (
            <section
              className="lane"
              key={state}
              aria-label={label(state)}
              onDragOver={(e) => {
                if (sprint.state !== "closed" && can(project, "item", "update"))
                  e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const item = Object.values(q.data!.columns)
                  .flatMap((c) => c.items)
                  .find((i) => i.id === id);
                if (item && can(item, "item", "update"))
                  change(item, state).catch(() => {});
              }}
            >
              <div className="lane-head">
                <State state={state} />
                <span className="count">{q.data!.columns[state].total}</span>
              </div>
              {q.data!.columns[state].items.map((i) => (
                <article
                  className="work-card"
                  key={i.id}
                  draggable={
                    sprint.state !== "closed" && can(i, "item", "update")
                  }
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", i.id)
                  }
                >
                  <div className="between">
                    <span className="key">{i.key}</span>
                    <span className="badge">{label(i.type)}</span>
                  </div>
                  <h3>
                    <ItemLink item={i} />
                  </h3>
                  <div className="row">
                    {i.labels.slice(0, 2).map((l) => (
                      <span className="label" key={l.id}>
                        {l.name}
                      </span>
                    ))}
                  </div>
                  <BlockerBadge item={i} />
                  <div className="card-foot">
                    <span className={"priority " + i.priority}>
                      {label(i.priority)}
                    </span>
                    <span
                      className="avatar"
                      aria-label={i.assignee?.display_name || "Unassigned"}
                    >
                      {i.assignee?.display_name.slice(0, 2) || "–"}
                    </span>
                  </div>
                  {sprint.state !== "closed" && can(i, "item", "update") && (
                    <select
                      className="card-state"
                      aria-label={"Change state of " + i.key}
                      value={i.state}
                      onChange={(e) =>
                        change(i, e.target.value).catch(() => {})
                      }
                    >
                      {states.map((s) => (
                        <option value={s} key={s}>
                          {label(s)}
                        </option>
                      ))}
                    </select>
                  )}
                </article>
              ))}
              {q.data!.columns[state].offset > 0 && (
                <button
                  className="btn small ghost"
                  onClick={() =>
                    setOffsets((o) => ({
                      ...o,
                      [state]: Math.max(0, (o[state] || 0) - 50),
                    }))
                  }
                >
                  Previous
                </button>
              )}
              {q.data!.columns[state].offset + q.data!.columns[state].limit <
                q.data!.columns[state].total && (
                <button
                  className="btn small ghost"
                  onClick={() =>
                    setOffsets((o) => ({ ...o, [state]: (o[state] || 0) + 50 }))
                  }
                >
                  Next 50
                </button>
              )}
            </section>
          ))}
        </div>
      </div>
      {transition && (
        <StateDialog {...transition} onClose={() => setTransition(null)} />
      )}{" "}
      {moving && (
        <MoveDialog items={[moving]} onClose={() => setMoving(null)} />
      )}{" "}
      {close && <CloseSprint sprint={sprint} onClose={() => setClose(false)} />}{" "}
      {create && (
        <ItemEditor
          projectId={id!}
          sprintId={sprintId}
          onClose={() => setCreate(false)}
        />
      )}
    </>
  );
}

import { useNavigate } from "react-router-dom";
