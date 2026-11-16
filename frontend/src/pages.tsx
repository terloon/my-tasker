import { Button } from "./controls";
import { ItemType, TypeIcon } from "./ItemType";
import SelectField from "./SelectField";
import { ask } from "./ui";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Markdown } from "./Markdown";
import {
  api,
  can,
  itemStateOptions,
  label,
  priorities,
  query,
  states,
  types,
  when,
  type HierarchyPage,
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
  SprintQuestionsNotice,
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
            <Button className="btn primary" onClick={() => setCreate(true)}>
              + New project
            </Button>
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
            <Button className="btn primary" onClick={() => setCreate(true)}>
              Create project
            </Button>
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
            <ItemTable items={q.data.assigned.items} />
          </section>
          {q.data.ready.total > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>Ready to resume</h2>
                <Link to="/items?ready_to_resume=true">View all →</Link>
              </div>
              <ItemTable items={q.data.ready.items} />
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
              <Button className="btn" onClick={() => setEdit(true)}>
                Edit project
              </Button>
            )}
            {user.is_admin && (
              <Button
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
              </Button>
            )}
          </>
        }
      />
      {!!w.error && <ErrorBox error={w.error} />}
      <div className="tabs">
        <Button
          className={"tab " + (tab === "overview" ? "active" : "")}
          onClick={() => setTab("overview")}
        >
          Overview
        </Button>
        <Button
          className={"tab " + (tab === "activity" ? "active" : "")}
          onClick={() => setTab("activity")}
        >
          Activity
        </Button>
      </div>
      {tab === "activity" ? (
        <Activity projectId={p.id} />
      ) : (
        <>
          <section className="panel">
            <h2>About this project</h2>
            <Markdown>{p.description || "No description yet."}</Markdown>
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

export { default as Planning } from "./Planning";

export function ItemList() {
  const [params, setParams] = useSearchParams();
  const { projects, project } = useWorkspace();
  const [create, setCreate] = useState(false);
  const [filters, setFilters] = useState(false);
  const [columns, setColumns] = useState(false);
  const [extra, setExtra] = useState(true);
  const [moving, setMoving] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState<Record<string, Item>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const hierarchy = params.get("view") === "hierarchy";
  const queryParams = new URLSearchParams(params);
  queryParams.delete("view");
  const filterCount = queryParams.size - Number(queryParams.has("offset"));
  const itemQuery = queryParams.toString();
  const flat = useData<Page<Item>>(
    ["items", itemQuery],
    "/items?" + itemQuery,
    !hierarchy,
  );
  const tree = useData<HierarchyPage>(
    ["item-hierarchy", itemQuery],
    "/items/hierarchy?" + itemQuery,
    hierarchy,
  );
  const q = hierarchy ? tree : flat;

  function setView(view: "list" | "hierarchy") {
    queryParams.delete("offset");
    if (view === "hierarchy") queryParams.set("view", "hierarchy");
    setParams(queryParams, { preventScrollReset: true });
  }

  function filter(key: string, values: string[]) {
    const p = new URLSearchParams(params);
    p.delete(key);
    values.filter(Boolean).forEach((v) => p.append(key, v));
    p.delete("offset");
    setCollapsed(new Set());
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
            <Button className="btn primary" onClick={() => setCreate(true)}>
              + Create item
            </Button>
          )
        }
      />
      <div className="filters">
        <div className="item-view-switch" role="group" aria-label="Item view">
          <Button
            className="btn small"
            type="button"
            aria-pressed={!hierarchy}
            onClick={() => hierarchy && setView("list")}
          >
            List
          </Button>
          <Button
            className="btn small"
            type="button"
            aria-pressed={hierarchy}
            onClick={() => !hierarchy && setView("hierarchy")}
          >
            Hierarchy
          </Button>
        </div>
        <input
          className="filter-input"
          type="search"
          aria-label="Search items"
          placeholder="Search title, key or description"
          value={params.get("q") || ""}
          onChange={(e) => filter("q", [e.target.value])}
        />
        <Button className="filter-chip" onClick={() => setFilters(!filters)}>
          Filters {filterCount > 0 && `(${filterCount})`} ⌄
        </Button>
        <Button
          className="btn ghost small"
          onClick={() => setColumns(!columns)}
        >
          Columns
        </Button>
        {filterCount > 0 && (
          <Button
            className="btn ghost small"
            onClick={() => {
              setCollapsed(new Set());
              setParams(hierarchy ? { view: "hierarchy" } : {});
            }}
          >
            Clear all
          </Button>
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
              itemTypes
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
            <SelectField
              title="Sort"
              value={params.get("sort") || "updated_at"}
              onChange={(value) => filter("sort", [value])}
              options={[
                "key",
                "title",
                "priority",
                "state",
                "created_at",
                "updated_at",
              ].map((s) => ({
                value: s,
                label: label(s),
              }))}
            />
            <SelectField
              title="Direction"
              value={params.get("direction") || "desc"}
              onChange={(value) => filter("direction", [value])}
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ]}
            />
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
          <Button
            className="btn"
            disabled={
              new Set(Object.values(selected).map((i) => i.project_id)).size !==
              1
            }
            onClick={() => setMoving(Object.values(selected))}
          >
            Move selected
          </Button>
          <Button className="btn ghost" onClick={() => setSelected({})}>
            Clear selection
          </Button>
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
              {...(hierarchy && tree.data
                ? {
                    items: tree.data.items,
                    tree: {
                      collapsed,
                      onToggle: (id: string) =>
                        setCollapsed((previous) => {
                          const next = new Set(previous);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        }),
                    },
                  }
                : { items: flat.data?.items ?? [] })}
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
              unit={hierarchy ? "at top level" : undefined}
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
  itemTypes = false,
}: {
  name: string;
  itemTypes?: boolean;
  value: string[];
  options: string[][];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <SelectField
        title={name}
        multiple
        value={value}
        onChange={onChange}
        options={options.map(([value, label]) => ({
          value,
          label,
          icon: itemTypes ? <TypeIcon type={value} /> : undefined,
        }))}
      />
      {itemTypes && (
        <span className="row type-filter-selection">
          {value.map((type) => (
            <ItemType key={type} type={type} />
          ))}
        </span>
      )}
    </div>
  );
}

function SprintOverview({
  sprint,
  canEdit,
  onEdit,
}: {
  sprint: Sprint;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const counts = sprint.counts;
  const total = sprint.total ?? 0;
  const done = counts?.done ?? 0;
  const cancelled = counts?.cancelled ?? 0;
  const percent = total ? Math.round(((done + cancelled) / total) * 100) : 0;
  return (
    <div className="sprint-overview section">
      <section className="panel sprint-goal">
        <div className="section-head">
          <h2>Description</h2>
          {canEdit && (
            <Button className="btn ghost small" onClick={onEdit}>
              {sprint.description ? "Edit description" : "Add description"}
            </Button>
          )}
        </div>
        {sprint.description ? (
          <Markdown>{sprint.description}</Markdown>
        ) : (
          <p className="muted">
            No description yet. Add the goal and context for this sprint.
          </p>
        )}
      </section>
      {counts ? (
        <section className="panel">
          <div className="section-head">
            <h2>Item overview</h2>
            <span className="small muted">{total} total items</span>
          </div>
          <div className="sprint-stat-grid">
            {states.map((state) => (
              <Link
                className="sprint-stat"
                key={state}
                to={
                  "/items?" +
                  query({
                    project_id: [sprint.project_id],
                    sprint_id: [sprint.id],
                    state: [state],
                  })
                }
              >
                <State state={state} />
                <strong>{counts[state] ?? 0}</strong>
                <span className="small muted">View items →</span>
              </Link>
            ))}
          </div>
          <div className="sprint-completion">
            <div className="between">
              <h3>{percent}% complete</h3>
              <span className="small muted">
                {done} Done · {cancelled} Cancelled · {total - done - cancelled}{" "}
                remaining
              </span>
            </div>
            <progress
              max={Math.max(total, 1)}
              value={done + cancelled}
              aria-label="Sprint completion"
            />
            <p className="small muted">
              Done and Cancelled items count toward sprint closure.
            </p>
          </div>
        </section>
      ) : (
        <div className="callout">
          Item view permission is required to see sprint statistics.
        </div>
      )}
    </div>
  );
}

export function SprintBoard() {
  const { id, sprintId } = useParams();
  const { project, user } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "board" ? "board" : "overview";
  const cancelledLanePreference = `planner-hide-cancelled-lane:${user.id}`;
  const [showCancelled, setShowCancelled] = useState(
    () => localStorage.getItem(cancelledLanePreference) !== "1",
  );
  const lanes = showCancelled
    ? states
    : states.filter((state) => state !== "cancelled");
  const [editing, setEditing] = useState(false);
  const info = useData<Sprint>(["sprint", sprintId], `/sprints/${sprintId}`);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const q = useData<{ sprint: Sprint; columns: Record<string, Page<Item>> }>(
    ["board", sprintId, offsets],
    `/sprints/${sprintId}/board?` +
      query(
        Object.fromEntries(
          Object.entries(offsets).map(([k, v]) => [k + "_offset", v]),
        ),
      ),
    view === "board" && can(project, "item"),
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
  if (info.isPending) return <Loading />;
  if (info.error)
    return <ErrorBox error={info.error} retry={() => info.refetch()} />;
  const sprint = info.data!;
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
            <SelectField
              ariaLabel="Choose sprint"
              value={sprint.id}
              unavailableLabel={sprint.name}
              onChange={(value) =>
                nav(`/projects/${id}/sprints/${value}?view=${view}`)
              }
              options={
                sp.data?.items.map((s) => ({ value: s.id, label: s.name })) ??
                []
              }
            />
            <Link
              className="btn"
              to={`/projects/${id}/planning?sprint=${sprint.id}`}
            >
              Plan sprint
            </Link>
            {can(project, "sprint", "update") && (
              <Button className="btn" onClick={() => setEditing(true)}>
                Edit sprint
              </Button>
            )}
            {can(project, "sprint", "update") && sprint.state === "active" && (
              <Button className="btn primary" onClick={() => setClose(true)}>
                Close sprint
              </Button>
            )}
            {can(project, "sprint", "update") && sprint.state === "planned" && (
              <Button
                className="btn primary"
                disabled={w.busy || !!sprint.counts?.open_question}
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
              </Button>
            )}
          </>
        }
      />
      <SprintQuestionsNotice sprint={sprint} />
      <nav className="tabs" aria-label="Sprint views">
        {["overview", "board"].map((value) => (
          <Button
            key={value}
            className={"tab " + (view === value ? "active" : "")}
            aria-current={view === value ? "page" : undefined}
            onClick={() => {
              const p = new URLSearchParams(params);
              p.set("view", value);
              setParams(p);
            }}
          >
            {label(value)}
          </Button>
        ))}
      </nav>
      {!!w.error && <ErrorBox error={w.error} />}{" "}
      {sprint.state === "closed" && (
        <div className="callout">
          This sprint is closed. Move an item out before changing its state.
        </div>
      )}
      <div className="between section">
        {sprint.counts && (
          <span className="small muted">
            {sprint.total} items · {sprint.counts.done || 0} Done ·{" "}
            {sprint.counts.cancelled || 0} Cancelled
          </span>
        )}
        <div className="row">
          {view === "board" && can(project, "item") && (
            <label className="check small">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => {
                  const show = e.currentTarget.checked;
                  if (show) localStorage.removeItem(cancelledLanePreference);
                  else localStorage.setItem(cancelledLanePreference, "1");
                  setShowCancelled(show);
                }}
              />
              Show Cancelled lane
            </label>
          )}
          {sprint.state !== "closed" && can(project, "item", "create") && (
            <Button className="btn small" onClick={() => setCreate(true)}>
              + Create item
            </Button>
          )}
        </div>
      </div>
      {view === "overview" ? (
        <SprintOverview
          sprint={sprint}
          canEdit={can(project, "sprint", "update")}
          onEdit={() => setEditing(true)}
        />
      ) : !can(project, "item") ? (
        <Empty title="Item access required">
          You need item view permission to use the board.
        </Empty>
      ) : q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : (
        <div className="board-scroll section">
          <div className="board">
            {lanes.map((state) => (
              <section
                className="lane"
                key={state}
                aria-label={label(state)}
                onDragOver={(e) => {
                  if (
                    sprint.state !== "closed" &&
                    can(project, "item", "update")
                  )
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
                      <ItemType type={i.type} />
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
                      <SelectField
                        className="card-state"
                        ariaLabel={"Change state of " + i.key}
                        value={i.state}
                        onChange={(value) => change(i, value).catch(() => {})}
                        options={itemStateOptions(i.state).map((s) => ({
                          value: s,
                          label: label(s),
                        }))}
                      />
                    )}
                  </article>
                ))}
                {q.data!.columns[state].offset > 0 && (
                  <Button
                    className="btn small ghost"
                    onClick={() =>
                      setOffsets((o) => ({
                        ...o,
                        [state]: Math.max(0, (o[state] || 0) - 50),
                      }))
                    }
                  >
                    Previous
                  </Button>
                )}
                {q.data!.columns[state].offset + q.data!.columns[state].limit <
                  q.data!.columns[state].total && (
                  <Button
                    className="btn small ghost"
                    onClick={() =>
                      setOffsets((o) => ({
                        ...o,
                        [state]: (o[state] || 0) + 50,
                      }))
                    }
                  >
                    Next 50
                  </Button>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
      {editing && (
        <SprintEditor
          projectId={id!}
          sprint={sprint}
          onClose={() => setEditing(false)}
        />
      )}
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
