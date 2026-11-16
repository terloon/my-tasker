import { ItemType, TypeSelect } from "./ItemType";
import { Markdown } from "./Markdown";
import { useRef, useState, type DragEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  api,
  ApiError,
  can,
  label,
  priorities,
  query,
  reorderItem,
  states,
  types,
  when,
  type Item,
  type Label,
  type Page,
  type Sprint,
  type User,
} from "./api/client";
import {
  ask,
  BlockerBadge,
  Empty,
  ErrorBox,
  Field,
  Heading,
  ItemLink,
  Loading,
  Pagination,
  Person,
  SprintQuestionsNotice,
  State,
  useCollection,
  useData,
  useWorkspace,
  useWrite,
} from "./ui";
import { CloseSprint, ItemEditor, MoveDialog, SprintEditor } from "./dialogs";
import { orderAfter, orderBefore } from "./planning-order";
import { reorderSprintStage, sprintStage } from "./sprint-catalog";

type Drag = { item: Item; origin: "sprint" | "backlog"; snapshot: Item[] };

export default function Planning() {
  const { id } = useParams();
  return <ProjectPlanning key={id} projectId={id!} />;
}

function ProjectPlanning({ projectId }: { projectId: string }) {
  const { project } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("sprint");
  const stage = sprintStage(params.get("sprint_state"));
  const [edit, setEdit] = useState<Sprint | "new" | null>(null);
  const [closing, setClosing] = useState<Sprint | null>(null);
  const sprints = useCollection<Sprint>(
    ["planning-sprints", projectId],
    `/projects/${projectId}/sprints`,
    can(project, "sprint"),
  );
  const sprint = sprints.data?.items.find((s) => s.id === selectedId);
  const activeSprint = sprints.data?.items.find((s) => s.state === "active");
  const visibleSprints =
    sprints.data?.items.filter((s) => s.state === stage) || [];
  const w = useWrite();
  const selectSprint = (id: string | null) =>
    setParams({
      ...(stage === "planned" ? {} : { sprint_state: stage }),
      ...(id ? { sprint: id } : {}),
    });
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
  async function reorder(id: string, delta: -1 | 1) {
    const all = reorderSprintStage(sprints.data!.items, stage, id, delta);
    await w.execute(() =>
      api(`/projects/${projectId}/sprint-order`, {
        method: "PUT",
        body: {
          ordered_ids: all.map((s) => s.id),
          versions: Object.fromEntries(all.map((s) => [s.id, s.version])),
        },
      }),
    );
  }
  if (!can(project, "sprint"))
    return (
      <Empty title="Sprint access required">
        You need sprint view permission to use Planning.
      </Empty>
    );
  return (
    <>
      <Heading
        title={sprint ? sprint.name : "Planning"}
        description={
          sprint ? (
            <>
              {label(sprint.state)}
              {sprint.started_at ? " · Started " + when(sprint.started_at) : ""}
            </>
          ) : (
            "Plan upcoming work and keep the current sprint in view."
          )
        }
        actions={
          <>
            {sprint ? (
              <>
                <Link
                  className="btn"
                  to={`/projects/${projectId}/sprints/${sprint.id}?view=overview`}
                >
                  Overview
                </Link>
                <Link
                  className="btn"
                  to={`/projects/${projectId}/sprints/${sprint.id}?view=board`}
                >
                  Board
                </Link>
                {can(project, "sprint", "update") && (
                  <button className="btn" onClick={() => setEdit(sprint)}>
                    Edit sprint
                  </button>
                )}
                {can(project, "sprint", "update") &&
                  sprint.state === "planned" && (
                    <button
                      className="btn primary"
                      disabled={w.busy || !!sprint.counts?.open_question}
                      onClick={() => start(sprint).catch(() => {})}
                    >
                      Start sprint
                    </button>
                  )}
                {can(project, "sprint", "update") &&
                  sprint.state === "active" && (
                    <button className="btn" onClick={() => setClosing(sprint)}>
                      Close sprint
                    </button>
                  )}
              </>
            ) : (
              can(project, "sprint", "create") && (
                <button className="btn primary" onClick={() => setEdit("new")}>
                  + New sprint
                </button>
              )
            )}
          </>
        }
      />
      {sprint && <SprintQuestionsNotice sprint={sprint} />}
      {sprints.data && !sprints.error && (
        <section
          className={
            "planning-active-sprint " + (!activeSprint ? "is-empty" : "")
          }
          aria-label="Active sprint"
        >
          <div className="planning-active-context">
            <span className="planning-active-label">Active sprint</span>
            {activeSprint ? (
              <>
                <h2>
                  <button
                    className="sprint-title-button"
                    onClick={() => selectSprint(activeSprint.id)}
                  >
                    {activeSprint.name}
                  </button>
                </h2>
                {activeSprint.description && (
                  <Markdown compact>{activeSprint.description}</Markdown>
                )}
                <p className="small muted">
                  {activeSprint.total !== undefined
                    ? `${activeSprint.total} items · ${activeSprint.counts?.done || 0} Done · `
                    : ""}
                  {activeSprint.started_at
                    ? `Started ${when(activeSprint.started_at)}`
                    : ""}
                </p>
              </>
            ) : (
              <p className="muted">
                No active sprint. Start a sprint from Not started when you are
                ready.
              </p>
            )}
          </div>
          {activeSprint && (
            <div className="row planning-active-actions">
              <button
                className="btn primary small"
                disabled={selectedId === activeSprint.id}
                onClick={() => selectSprint(activeSprint.id)}
              >
                {selectedId === activeSprint.id
                  ? "Planning this sprint"
                  : "Plan active sprint"}
              </button>
              <Link
                className="btn small"
                to={`/projects/${projectId}/sprints/${activeSprint.id}?view=board`}
              >
                Board
              </Link>
              <Link
                className="btn small"
                to={`/projects/${projectId}/sprints/${activeSprint.id}?view=overview`}
              >
                Overview
              </Link>
              {can(project, "sprint", "update") && (
                <button
                  className="btn small"
                  onClick={() => setClosing(activeSprint)}
                >
                  Close sprint
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {selectedId && (
        <button
          className="btn ghost planning-back"
          onClick={() => selectSprint(null)}
        >
          ← Sprint list
        </button>
      )}
      {!!w.error && (
        <ErrorBox error={w.error} retry={() => sprints.refetch()} />
      )}
      {!selectedId && (
        <nav className="tabs" aria-label="Sprint status">
          {(["planned", "closed"] as const).map((state) => (
            <button
              key={state}
              className={"tab " + (stage === state ? "active" : "")}
              aria-current={stage === state ? "page" : undefined}
              onClick={() =>
                setParams(state === "planned" ? {} : { sprint_state: state })
              }
            >
              {label(state)}{" "}
              <span className="count">
                {sprints.data?.items.filter((s) => s.state === state).length ??
                  "…"}
              </span>
            </button>
          ))}
        </nav>
      )}
      {sprints.isPending ? (
        <Loading />
      ) : sprints.error ? (
        <ErrorBox error={sprints.error} retry={() => sprints.refetch()} />
      ) : selectedId ? (
        sprint ? (
          <SprintWorkspace key={sprint.id} sprint={sprint} />
        ) : (
          <Empty title="Sprint not found">
            Choose a sprint from this project's list.
          </Empty>
        )
      ) : visibleSprints.length ? (
        <div className="sprint-catalog" aria-label="Project sprints">
          {visibleSprints.map((s, index) => (
            <article
              className={
                "sprint-summary " + (s.state === "active" ? "is-active" : "")
              }
              key={s.id}
            >
              <div className="sprint-summary-main">
                <div className="row">
                  <span className="sprint-number">{index + 1}</span>
                  <h2>
                    <button
                      className="sprint-title-button"
                      onClick={() => selectSprint(s.id)}
                    >
                      {s.name}
                    </button>
                  </h2>
                  <span className="badge">{label(s.state)}</span>
                </div>
                {s.description ? (
                  <Markdown compact>{s.description}</Markdown>
                ) : (
                  <p className="small muted">No description yet</p>
                )}
                {s.total !== undefined && (
                  <div className="small muted">
                    {s.total} items · {s.counts?.done || 0} Done ·{" "}
                    {s.counts?.cancelled || 0} Cancelled
                    {!!s.counts?.open_question && (
                      <>
                        {" "}
                        · {s.counts.open_question} open question
                        {s.counts.open_question === 1 ? "" : "s"}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="sprint-summary-actions">
                <button
                  className="btn primary small"
                  onClick={() => selectSprint(s.id)}
                >
                  {s.state === "closed" ? "View plan" : "Plan sprint"}
                </button>
                <Link
                  className="btn small"
                  to={`/projects/${projectId}/sprints/${s.id}?view=overview`}
                >
                  View sprint
                </Link>
                {can(project, "sprint", "update") && (
                  <>
                    <button
                      className="btn ghost small"
                      onClick={() => setEdit(s)}
                    >
                      Edit
                    </button>
                    {stage !== "closed" && (
                      <>
                        <button
                          className="btn ghost small"
                          aria-label={`Move ${s.name} up`}
                          disabled={!index || w.busy}
                          onClick={() => reorder(s.id, -1).catch(() => {})}
                        >
                          ↑
                        </button>
                        <button
                          className="btn ghost small"
                          aria-label={`Move ${s.name} down`}
                          disabled={
                            index === visibleSprints.length - 1 || w.busy
                          }
                          onClick={() => reorder(s.id, 1).catch(() => {})}
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </>
                )}
                {s.state === "planned" && can(project, "sprint", "delete") && (
                  <button
                    className="btn ghost small danger-text"
                    disabled={w.busy}
                    onClick={async () => {
                      if (
                        await ask(
                          `Delete ${s.name}? Only empty, not-started sprints can be removed.`,
                        )
                      )
                        w.execute(() =>
                          api(`/sprints/${s.id}`, {
                            method: "DELETE",
                            version: s.version,
                          }),
                        ).catch(() => {});
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={
            stage === "planned" ? "No unstarted sprints" : "No closed sprints"
          }
        >
          {stage === "planned"
            ? "Create a sprint to plan the next work."
            : "Closed sprints will appear here, separate from upcoming work."}
        </Empty>
      )}
      {edit && (
        <SprintEditor
          projectId={projectId}
          sprint={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
      {closing && (
        <CloseSprint sprint={closing} onClose={() => setClosing(null)} />
      )}
    </>
  );
}

function SprintWorkspace({ sprint }: { sprint: Sprint }) {
  const { project } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const questionsOnly = params.get("open_questions") === "1";
  const planningSearch = params.toString();
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragging = useRef<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [create, setCreate] = useState<"sprint" | "backlog" | null>(null);
  const [moving, setMoving] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState<Record<string, Item>>({});
  const w = useWrite();
  const backlogEditable = can(project, "item", "update");
  const editable = backlogEditable && sprint.state !== "closed";
  const view = can(project, "item");
  const items = useCollection<Item>(
    ["planning-items", sprint.id],
    "/items?" +
      query({
        project_id: [sprint.project_id],
        sprint_id: [sprint.id],
        sort: "rank",
        direction: "asc",
      }),
    view,
  );
  const sprintItems = items.data?.items ?? [];
  const questions = sprintItems.filter(
    (item) => item.state === "open_question",
  );
  const visibleItems = questionsOnly ? questions : sprintItems;
  const filters = {
    q: params.get("q") || "",
    state: params.get("state") || "",
    type: params.get("type") || "",
    priority: params.get("priority") || "",
    assignee: params.get("assignee") || "",
    label: params.get("label") || "",
  };
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const backlogOrder = useCollection<Item>(
    ["planning-backlog-order", sprint.project_id],
    "/items?" +
      query({
        project_id: [sprint.project_id],
        backlog: true,
        sort: "rank",
        direction: "asc",
      }),
    backlogEditable,
  );
  const canOrderBacklog =
    backlogEditable && !!backlogOrder.data && !backlogOrder.error;
  const backlogPath =
    "/items?" +
    query({
      project_id: [sprint.project_id],
      backlog: true,
      sort: "rank",
      direction: "asc",
      q: filters.q,
      state: filters.state ? [filters.state] : [],
      type: filters.type ? [filters.type] : [],
      priority: filters.priority ? [filters.priority] : [],
      assignee_id:
        filters.assignee && filters.assignee !== "unassigned"
          ? [filters.assignee]
          : [],
      unassigned: filters.assignee === "unassigned",
      label_id: filters.label ? [filters.label] : [],
      offset,
    });
  const back = useData<Page<Item>>(
    ["planning-backlog", sprint.project_id, filters, offset],
    backlogPath,
    view,
  );
  const assignees = useData<User[]>(
    ["assignees", sprint.project_id],
    `/projects/${sprint.project_id}/assignees`,
    view,
  );
  const labels = useData<Label[]>(
    ["labels", sprint.project_id],
    `/projects/${sprint.project_id}/labels`,
    view,
  );
  const filter = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    value ? p.set(key, value) : p.delete(key);
    p.delete("offset");
    setParams(p, { replace: true });
  };
  function begin(e: DragEvent, item: Item, origin: Drag["origin"]) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.key);
    dragging.current = {
      item,
      origin,
      snapshot:
        (origin === "backlog"
          ? backlogOrder.data?.items
          : items.data?.items
        )?.slice() || [],
    };
    setDrag(dragging.current);
  }
  function end() {
    dragging.current = null;
    setDrag(null);
    setOver(null);
  }
  function questionAction(item: Item) {
    const hasQuestion = item.state === "open_question";
    if (!hasQuestion && item.state !== "open") return null;
    return (
      <button
        className="btn small ghost"
        disabled={w.busy}
        aria-label={
          hasQuestion
            ? `Return ${item.key} to Open`
            : `Flag ${item.key} as an open question`
        }
        onClick={async () => {
          const updated = await w
            .execute(
              () =>
                api<Item>(`/items/${item.id}`, {
                  method: "PATCH",
                  version: item.version,
                  body: { state: hasQuestion ? "open" : "open_question" },
                }),
              hasQuestion
                ? `${item.key} returned to Open.`
                : `Open question flagged on ${item.key}.`,
            )
            .catch(() => null);
          if (updated)
            setSelected((previous) =>
              previous[item.id]
                ? { ...previous, [item.id]: updated }
                : previous,
            );
        }}
      >
        {hasQuestion ? "Return to Open" : "Flag question"}
      </button>
    );
  }
  async function move(backlogItems: Item[], destination: string | null) {
    try {
      await w.execute(
        () =>
          api(`/projects/${sprint.project_id}/items/bulk-move`, {
            method: "POST",
            key: crypto.randomUUID(),
            body: {
              sprint_id: destination,
              item_versions: Object.fromEntries(
                backlogItems.map((i) => [i.id, i.version]),
              ),
            },
          }),
        destination
          ? `${backlogItems.length} item${backlogItems.length === 1 ? "" : "s"} added to sprint.`
          : "Item moved to Backlog.",
      );
      setSelected({});
    } catch {
      items.refetch();
      back.refetch();
    }
  }
  async function drop(e: DragEvent, beforeId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    const current = dragging.current;
    end();
    if (!current || !editable || w.busy) return;
    if (current.origin === "backlog") {
      await move([current.item], sprint.id);
      return;
    }
    try {
      const ordered = orderBefore(current.snapshot, current.item.id, beforeId);
      if (ordered.every((i, n) => i.id === current.snapshot[n]?.id)) return;
      await saveSprintOrder(current.snapshot, ordered);
    } catch (error) {
      w.setError(error);
      items.refetch();
    }
  }
  function saveSprintOrder(snapshot: Item[], ordered: Item[]) {
    return w.execute(
      () =>
        api(`/projects/${sprint.project_id}/item-order`, {
          method: "PUT",
          body: {
            sprint_id: sprint.id,
            ordered_ids: ordered.map((i) => i.id),
            versions: Object.fromEntries(
              snapshot.map((i) => [i.id, i.version]),
            ),
          },
        }),
      "Sprint order updated.",
    );
  }
  function moveSprintItem(item: Item, index: number, delta: -1 | 1) {
    if (!questionsOnly)
      return w.execute(() => reorderItem(item, delta), "Sprint order updated.");
    const neighbor = visibleItems[index + delta];
    if (!neighbor) return;
    const ordered =
      delta < 0
        ? orderBefore(sprintItems, item.id, neighbor.id)
        : orderAfter(sprintItems, item.id, neighbor.id);
    return saveSprintOrder(sprintItems, ordered);
  }
  function allow(e: DragEvent, target: string) {
    if (editable && dragging.current && !w.busy) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOver(target);
    }
  }
  function allowBacklog(e: DragEvent, target: string) {
    if (canOrderBacklog && dragging.current?.origin === "backlog" && !w.busy) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOver(target);
    }
  }
  function checkSnapshot(snapshot: Item[], item: Item) {
    if (snapshot.find((i) => i.id === item.id)?.version !== item.version)
      throw new ApiError(
        412,
        "version_conflict",
        "The backlog changed. Reload before reordering.",
      );
  }
  async function saveBacklogOrder(snapshot: Item[], ordered: Item[]) {
    if (ordered.every((i, n) => i.id === snapshot[n]?.id)) return;
    await api(`/projects/${sprint.project_id}/item-order`, {
      method: "PUT",
      body: {
        sprint_id: null,
        ordered_ids: ordered.map((i) => i.id),
        versions: Object.fromEntries(snapshot.map((i) => [i.id, i.version])),
      },
    });
  }
  function refreshBacklog() {
    backlogOrder.refetch();
    back.refetch();
  }
  async function dropBacklog(e: DragEvent, beforeId: string | null) {
    e.preventDefault();
    e.stopPropagation();
    const current = dragging.current;
    end();
    if (!current || current.origin !== "backlog" || !canOrderBacklog || w.busy)
      return;
    try {
      await w.execute(async () => {
        checkSnapshot(current.snapshot, current.item);
        await saveBacklogOrder(
          current.snapshot,
          orderBefore(current.snapshot, current.item.id, beforeId),
        );
      }, "Backlog order updated.");
    } catch {
      refreshBacklog();
    }
  }
  async function moveBacklog(
    item: Item,
    index: number,
    direction: -1 | 1 | "top",
  ) {
    if (!canOrderBacklog || w.busy) return;
    const snapshot = backlogOrder.data!.items.slice();
    try {
      await w.execute(async () => {
        checkSnapshot(snapshot, item);
        let ordered: Item[];
        if (direction === "top")
          ordered = orderBefore(snapshot, item.id, snapshot[0]?.id ?? null);
        else {
          const position = offset + index + direction;
          if (position < 0 || position >= (back.data?.total ?? 0)) return;
          let neighbor = back.data?.items[index + direction];
          if (!neighbor) {
            const search = new URLSearchParams(backlogPath.split("?")[1]);
            search.set("offset", String(position));
            search.set("limit", "1");
            neighbor = (await api<Page<Item>>("/items?" + search)).items[0];
          }
          if (!neighbor)
            throw new ApiError(
              409,
              "order_scope_changed",
              "The backlog changed. Reload before reordering.",
            );
          checkSnapshot(snapshot, neighbor);
          ordered =
            direction === -1
              ? orderBefore(snapshot, item.id, neighbor.id)
              : orderAfter(snapshot, item.id, neighbor.id);
        }
        await saveBacklogOrder(snapshot, ordered);
      }, "Backlog order updated.");
    } catch {
      refreshBacklog();
    }
  }
  const toggle = (item: Item) =>
    setSelected((previous) => {
      const next = { ...previous };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  if (!view)
    return (
      <Empty title="Item access required">
        You need item view permission to plan work.
      </Empty>
    );
  return (
    <div className="planning-workspace">
      {sprint.state === "closed" && (
        <div className="callout">
          This sprint is closed. Its order is fixed. Move work to another sprint
          or Backlog to continue planning.
        </div>
      )}
      {!!w.error && (
        <ErrorBox
          error={w.error}
          retry={() => {
            items.refetch();
            back.refetch();
          }}
        />
      )}
      {w.message && (
        <p className="planning-feedback" role="status">
          {w.message}
        </p>
      )}
      <section
        className="planning-sprint-panel"
        aria-labelledby="sprint-items-heading"
      >
        <div className="section-head">
          <div>
            <h2 id="sprint-items-heading">
              Sprint items{" "}
              <span className="count">{items.data?.total ?? "…"}</span>
            </h2>
            <p className="small muted">
              {editable
                ? "Drag rows to reorder. Add backlog items below."
                : "Items in their planned order."}
            </p>
          </div>
          <div className="row planning-items-actions">
            <button
              className="btn small"
              aria-pressed={questionsOnly}
              onClick={() => {
                const next = new URLSearchParams(params);
                if (questionsOnly) next.delete("open_questions");
                else next.set("open_questions", "1");
                setParams(next, { replace: true, preventScrollReset: true });
              }}
            >
              Open questions <span className="count">{questions.length}</span>
            </button>
            {sprint.state !== "closed" && can(project, "item", "create") && (
              <button className="btn small" onClick={() => setCreate("sprint")}>
                + Create item
              </button>
            )}
          </div>
        </div>
        {items.isPending ? (
          <Loading />
        ) : items.error ? (
          <ErrorBox error={items.error} retry={() => items.refetch()} />
        ) : (
          <ol className="planning-items" aria-label="Sprint item order">
            {visibleItems.map((item, index) => (
              <li
                key={item.id}
                data-state={item.state}
                className={
                  "planning-work-row " +
                  (drag?.item.id === item.id ? "is-dragging " : "") +
                  (over === item.id && drag?.origin === "sprint"
                    ? "drop-before"
                    : "")
                }
                draggable={editable && !w.busy}
                onDragStart={(e) => begin(e, item, "sprint")}
                onDragEnd={end}
                onDragEnter={(e) => allow(e, item.id)}
                onDragOver={(e) => allow(e, item.id)}
                onDrop={(e) => drop(e, item.id)}
              >
                <span className="drag-handle" aria-hidden="true">
                  {editable ? "⠿" : index + 1}
                </span>
                <span className="key">{item.key}</span>
                <div className="planning-work-title">
                  <ItemLink item={item} planningSearch={planningSearch} />
                  <div className="row small muted">
                    <ItemType type={item.type} />
                    <span>{label(item.priority)} priority</span>
                    <BlockerBadge item={item} />
                  </div>
                </div>
                <State state={item.state} />
                <Person user={item.assignee} />
                {can(project, "item", "update") && (
                  <div className="planning-row-actions">
                    {editable && questionAction(item)}
                    {editable && (
                      <>
                        <button
                          className="btn small ghost"
                          disabled={!index || w.busy}
                          aria-label={`Move ${item.key} up`}
                          onClick={() =>
                            moveSprintItem(item, index, -1)?.catch(() => {})
                          }
                        >
                          ↑
                        </button>
                        <button
                          className="btn small ghost"
                          disabled={index === visibleItems.length - 1 || w.busy}
                          aria-label={`Move ${item.key} down`}
                          onClick={() =>
                            moveSprintItem(item, index, 1)?.catch(() => {})
                          }
                        >
                          ↓
                        </button>
                      </>
                    )}
                    <button
                      className="btn small ghost"
                      disabled={w.busy}
                      onClick={() => setMoving([item])}
                    >
                      Move
                    </button>
                    <button
                      className="btn small ghost"
                      disabled={w.busy}
                      aria-label={`Move ${item.key} to backlog`}
                      onClick={() => move([item], null)}
                    >
                      To backlog
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {questionsOnly && items.data && visibleItems.length === 0 && (
          <Empty title="No open questions">
            Select Open questions again to show all sprint items.
          </Empty>
        )}
        {editable && (
          <div
            className={
              "planning-drop-zone " + (over === "end" ? "is-over" : "")
            }
            onDragEnter={(e) => allow(e, "end")}
            onDragOver={(e) => allow(e, "end")}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => drop(e, null)}
          >
            <strong>
              {drag?.origin === "sprint"
                ? "Drop here to move to the end"
                : "Drop backlog items here"}
            </strong>
            <span>
              Items are added at the end. Drag them into the order you want.
            </span>
          </div>
        )}
        {!editable && !items.isPending && !items.data?.total && (
          <Empty title="No sprint items" />
        )}
      </section>
      <section
        className="planning-backlog-panel"
        aria-labelledby="planning-backlog-heading"
      >
        <div className="section-head">
          <div>
            <h2 id="planning-backlog-heading">
              Backlog <span className="count">{back.data?.total ?? "…"}</span>
            </h2>
            <p className="small muted">
              Drag backlog rows to change their order, or add them to the sprint
              above.
            </p>
          </div>
          {can(project, "item", "create") && (
            <button className="btn small" onClick={() => setCreate("backlog")}>
              + Create backlog item
            </button>
          )}
        </div>
        {backlogEditable && (
          <p className="small muted backlog-order-hint">
            Manual order is saved for this project's backlog. With filters, move
            matching items relative to each other; hidden items keep their
            relative order. ⇈ moves an item to the top of the entire backlog.
          </p>
        )}
        {backlogEditable && backlogOrder.isPending && (
          <p className="small muted backlog-order-hint" role="status">
            Loading the complete backlog order…
          </p>
        )}
        {backlogOrder.error && (
          <ErrorBox
            error={backlogOrder.error}
            retry={() => backlogOrder.refetch()}
          />
        )}
        <div className="planning-filters">
          <Field name="Search backlog">
            <input
              type="search"
              placeholder="Search title, description or key"
              value={filters.q}
              maxLength={500}
              onChange={(e) => filter("q", e.target.value)}
            />
          </Field>
          <Field name="Type">
            <TypeSelect
              value={filters.type}
              onChange={(e) => filter("type", e.target.value)}
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </TypeSelect>
          </Field>
          <Field name="State">
            <select
              value={filters.state}
              onChange={(e) => filter("state", e.target.value)}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Priority">
            <select
              value={filters.priority}
              onChange={(e) => filter("priority", e.target.value)}
            >
              <option value="">All priorities</option>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Assignee">
            <select
              value={filters.assignee}
              onChange={(e) => filter("assignee", e.target.value)}
            >
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {assignees.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </Field>
          <Field name="Label">
            <select
              value={filters.label}
              onChange={(e) => filter("label", e.target.value)}
            >
              <option value="">All labels</option>
              {labels.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {(Object.values(filters).some(Boolean) ||
          !!Object.keys(selected).length) && (
          <div className="between planning-filter-actions">
            <button
              className="btn ghost small"
              onClick={() => {
                const next = new URLSearchParams(params);
                for (const key of Object.keys(filters)) next.delete(key);
                next.delete("offset");
                setParams(next, { replace: true });
              }}
            >
              Clear filters
            </button>
            {editable && !!Object.keys(selected).length && (
              <button
                className="btn primary small"
                disabled={w.busy}
                onClick={() => move(Object.values(selected), sprint.id)}
              >
                Add {Object.keys(selected).length} selected to sprint
              </button>
            )}
          </div>
        )}
        {back.isPending ? (
          <Loading />
        ) : back.error ? (
          <ErrorBox error={back.error} retry={() => back.refetch()} />
        ) : back.data?.items.length ? (
          <ul className="planning-items" aria-label="Backlog items">
            {back.data.items.map((item, index) => (
              <li
                data-state={item.state}
                className={
                  "planning-work-row backlog-work-row " +
                  (drag?.item.id === item.id ? "is-dragging " : "") +
                  (over === item.id && drag?.origin === "backlog"
                    ? "drop-before"
                    : "")
                }
                key={item.id}
                draggable={canOrderBacklog && !w.busy}
                onDragStart={(e) => begin(e, item, "backlog")}
                onDragEnd={end}
                onDragEnter={(e) => allowBacklog(e, item.id)}
                onDragOver={(e) => allowBacklog(e, item.id)}
                onDrop={(e) => dropBacklog(e, item.id)}
              >
                {editable ? (
                  <input
                    type="checkbox"
                    checked={!!selected[item.id]}
                    aria-label={`Select ${item.key}`}
                    onChange={() => toggle(item)}
                  />
                ) : (
                  <span aria-hidden="true">·</span>
                )}
                <span className="key">
                  {canOrderBacklog && (
                    <span className="drag-handle" aria-hidden="true">
                      ⠿
                    </span>
                  )}
                  {item.key}
                </span>
                <div className="planning-work-title">
                  <ItemLink item={item} planningSearch={planningSearch} />
                  <div className="row small muted">
                    <ItemType type={item.type} />
                    <span>{label(item.priority)} priority</span>
                    <BlockerBadge item={item} />
                  </div>
                </div>
                <State state={item.state} />
                <Person user={item.assignee} />
                {backlogEditable && (
                  <div className="planning-row-actions">
                    {questionAction(item)}
                    <button
                      className="btn small ghost"
                      title="Move to top of backlog"
                      aria-label={`Move ${item.key} to top of backlog`}
                      disabled={
                        !canOrderBacklog ||
                        w.busy ||
                        backlogOrder.data?.items[0]?.id === item.id
                      }
                      onClick={() => moveBacklog(item, index, "top")}
                    >
                      ⇈
                    </button>
                    <button
                      className="btn small ghost"
                      title="Move up"
                      aria-label={`Move ${item.key} up in backlog`}
                      disabled={
                        !canOrderBacklog || w.busy || offset + index === 0
                      }
                      onClick={() => moveBacklog(item, index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className="btn small ghost"
                      title="Move down"
                      aria-label={`Move ${item.key} down in backlog`}
                      disabled={
                        !canOrderBacklog ||
                        w.busy ||
                        offset + index + 1 >= back.data!.total
                      }
                      onClick={() => moveBacklog(item, index, 1)}
                    >
                      ↓
                    </button>
                    {editable && (
                      <button
                        className="btn small"
                        disabled={w.busy}
                        onClick={() => move([item], sprint.id)}
                      >
                        Add to sprint ↑
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No backlog items match">
            Try adjusting the filters or create a backlog item.
          </Empty>
        )}
        {canOrderBacklog && !!back.data?.items.length && (
          <div
            className={
              "planning-drop-zone " + (over === "backlog-end" ? "is-over" : "")
            }
            onDragEnter={(e) => allowBacklog(e, "backlog-end")}
            onDragOver={(e) => allowBacklog(e, "backlog-end")}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => dropBacklog(e, null)}
          >
            <strong>Drop here to move to the end of Backlog</strong>
            <span>
              Places the item after all backlog items, including those hidden by
              filters or on other pages.
            </span>
          </div>
        )}
        {back.data && (
          <Pagination
            data={back.data}
            onChange={(next) => {
              const p = new URLSearchParams(params);
              p.set("offset", String(next));
              setParams(p, { replace: true });
            }}
          />
        )}
        {(assignees.error || labels.error) && (
          <p className="small muted">
            Some filter options could not be loaded.{" "}
            <button
              className="btn ghost small"
              onClick={() => {
                assignees.refetch();
                labels.refetch();
              }}
            >
              Retry options
            </button>
          </p>
        )}
      </section>
      {create && (
        <ItemEditor
          projectId={sprint.project_id}
          sprintId={create === "sprint" ? sprint.id : undefined}
          onClose={() => setCreate(null)}
        />
      )}
      {moving && <MoveDialog items={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}
