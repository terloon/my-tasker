import { ItemType } from "./ItemType";
import { Button } from "./controls";
import { visibleHierarchyItems } from "./item-hierarchy";
import {
  createContext,
  useContext,
  useEffect,
  lazy,
  Suspense,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  allPages,
  api,
  ApiError,
  can,
  label,
  when,
  type HierarchyItem,
  type Item,
  type Page,
  type Event as ActivityEvent,
  type Project,
  type Sprint,
  type User,
} from "./api/client";

export const Workspace = createContext<{
  user: User;
  projects: Project[];
  project: Project | null;
  selectProject: (id: string) => void;
  logout: () => void;
}>({} as never);
export const useWorkspace = () => useContext(Workspace);

export function ask(message: string): Promise<boolean> {
  return new Promise((resolve) =>
    window.dispatchEvent(
      new CustomEvent("planner-confirm", { detail: { message, resolve } }),
    ),
  );
}
export function ConfirmHost() {
  const [pending, setPending] = useState<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);
  useEffect(() => {
    const handle = (e: Event) => setPending((e as CustomEvent).detail);
    window.addEventListener("planner-confirm", handle);
    return () => window.removeEventListener("planner-confirm", handle);
  }, []);
  if (!pending) return null;
  const verb = /^delete|^permanently/i.test(pending.message)
    ? "Delete"
    : /^disable/i.test(pending.message)
      ? "Disable account"
      : /^enable/i.test(pending.message)
        ? "Enable account"
        : /^rotate/i.test(pending.message)
          ? "Rotate password"
          : /^start/i.test(pending.message)
            ? "Start sprint"
            : /^discard/i.test(pending.message)
              ? "Discard changes"
              : /^remove|^removing|^revoke/i.test(pending.message)
                ? "Remove"
                : "Continue";
  function finish(value: boolean) {
    pending!.resolve(value);
    setPending(null);
  }
  return (
    <Modal
      key={pending.message}
      title={verb === "Continue" ? "Confirm action" : verb + "?"}
      onClose={() => finish(false)}
      footer={
        <>
          <Button className="btn" onClick={() => finish(false)}>
            Keep unchanged
          </Button>
          <Button
            className={
              "btn " +
              ([
                "Delete",
                "Disable account",
                "Rotate password",
                "Remove",
                "Discard changes",
              ].includes(verb)
                ? "danger"
                : "primary")
            }
            onClick={() => finish(true)}
          >
            {verb}
          </Button>
        </>
      }
    >
      <p>{pending.message}</p>
    </Modal>
  );
}
async function readWithSessionRecovery<T>(
  client: QueryClient,
  key: unknown[],
  read: () => Promise<T>,
) {
  try {
    return await read();
  } catch (error) {
    // The sign-in dialog covers the workspace until these queries can refresh.
    if (error instanceof ApiError && error.status === 401) {
      const previous = client.getQueryData<T>(key);
      if (previous !== undefined) return previous;
    }
    throw error;
  }
}
export function useData<T>(
  key: unknown[],
  path: string,
  enabled = true,
  poll = true,
) {
  const client = useQueryClient();
  return useQuery<T>({
    queryKey: key,
    queryFn: () => readWithSessionRecovery(client, key, () => api<T>(path)),
    enabled,
    refetchInterval: poll ? 10000 : false,
    refetchOnWindowFocus: poll,
    refetchIntervalInBackground: false,
    retry: (n, e) =>
      !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 1,
  });
}
export function useItem(itemId?: string, { observeOnly = false } = {}) {
  return useData<Item>(
    ["item", itemId],
    `/items/${itemId}`,
    !!itemId && !observeOnly,
    !observeOnly,
  );
}
export function useCollection<T>(key: unknown[], path: string, enabled = true) {
  const client = useQueryClient();
  return useQuery<Page<T>>({
    queryKey: key,
    queryFn: () =>
      readWithSessionRecovery(client, key, () => allPages<T>(path)),
    enabled,
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="form-error" role="alert">
      <p>{error instanceof Error ? error.message : "Something went wrong."}</p>
      {error instanceof ApiError && error.status === 412 && (
        <p className="small">
          Your draft has not been saved. Review the latest version before
          reapplying it.
        </p>
      )}
      {retry && (
        <Button className="btn small" onClick={retry}>
          Retry
        </Button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading-panel" role="status" aria-label="Loading">
      <div className="skeleton short" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden>
        □
      </span>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
export function Heading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = title + " · Local Planner";
  }, [title]);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  return (
    <div className="page-head">
      <div>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      <div className="row">{actions}</div>
    </div>
  );
}
export function State({ state }: { state: string }) {
  return <span className={"state " + state}>{label(state)}</span>;
}
export function SprintQuestionsNotice({ sprint }: { sprint: Sprint }) {
  const count = sprint.counts?.open_question ?? 0;
  return sprint.state === "planned" && count > 0 ? (
    <p className="callout warning sprint-questions-notice" role="status">
      {count === 1 ? "1 item has" : `${count} items have`} open questions.
      Return {count === 1 ? "it" : "them"} to Open before starting this sprint.
    </p>
  ) : null;
}
export function Person({
  user,
}: {
  user?: Pick<User, "display_name" | "kind" | "username"> | null;
}) {
  return (
    <span className="row person">
      <span
        className={"avatar " + (user?.kind === "agent" ? "agent" : "")}
        aria-hidden
      >
        {user
          ? user.kind === "agent"
            ? "A"
            : user.display_name.slice(0, 2).toUpperCase()
          : "–"}
      </span>
      <span>{user?.display_name || "Unassigned"}</span>
      {user?.kind === "agent" && <span className="badge agent">Agent</span>}
    </span>
  );
}
export function BlockerBadge({ item }: { item: Item }) {
  return item.state === "blocked" ? (
    <>
      <span className="dependency-pill">
        {item.blocker_summary.total} blocker
        {item.blocker_summary.total === 1 ? "" : "s"}
      </span>
      {item.blocker_summary.ready_to_resume && (
        <span className="ready-label">✓ Ready to resume</span>
      )}
    </>
  ) : null;
}
export function ItemLink({
  item,
  planningSearch,
}: {
  item: Item;
  planningSearch?: string;
}) {
  return (
    <Link
      className="item-title"
      to={`/projects/${item.project_id}/items/${item.id}`}
      state={planningSearch === undefined ? undefined : { planningSearch }}
    >
      {item.title}
    </Link>
  );
}
type ItemTableProps = {
  extra?: boolean;
  selected?: Set<string>;
  onSelect?: (item: Item) => void;
  onState?: (item: Item) => ReactNode;
} & (
  | { items: Item[]; tree?: undefined }
  | {
      items: HierarchyItem[];
      tree: { collapsed: ReadonlySet<string>; onToggle: (id: string) => void };
    }
);

export function ItemTable(props: ItemTableProps) {
  const { extra, selected, onSelect, onState, tree } = props;
  const rows = props.tree
    ? visibleHierarchyItems(props.items, props.tree.collapsed).map((item) => ({
        item,
        branch: item,
      }))
    : props.items.map((item) => ({ item, branch: null }));
  return (
    <div className="panel flush table-wrap">
      <table className="table">
        <thead>
          <tr>
            {onSelect && <th>Select</th>}
            <th>Key</th>
            <th>Title</th>
            <th scope="col">Type</th>
            <th>State</th>
            <th>Priority</th>
            <th>Assignee</th>
            {extra && (
              <>
                <th>Sprint</th>
                <th>Labels</th>
                <th>Updated</th>
              </>
            )}
            {onState && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ item: i, branch }) => {
            const editable =
              can(i, "item", "update") && (branch?.matches_filters ?? true);
            const title = (
              <>
                <ItemLink item={i} /> <BlockerBadge item={i} />
              </>
            );
            const expanded = !tree?.collapsed.has(i.id);
            return (
              <tr
                key={i.id}
                draggable={!!onSelect && editable}
                onDragStart={(e) =>
                  e.dataTransfer.setData(
                    "text/plain",
                    JSON.stringify({ id: i.id, version: i.version }),
                  )
                }
              >
                {onSelect && (
                  <td>
                    <input
                      disabled={!editable}
                      type="checkbox"
                      aria-label={`Select ${i.key}`}
                      checked={selected?.has(i.id) || false}
                      onChange={() => onSelect(i)}
                    />
                  </td>
                )}
                <td className="key">{i.key}</td>
                <td className="title-cell">
                  {branch ? (
                    <div
                      className="hierarchy-title"
                      style={{
                        paddingInlineStart: `${Math.min(branch.depth, 8) * 1.15}rem`,
                      }}
                    >
                      {branch.has_children ? (
                        <Button
                          className="hierarchy-toggle"
                          type="button"
                          aria-label={`${expanded ? "Collapse" : "Expand"} ${i.key}`}
                          aria-expanded={expanded}
                          onClick={() => tree?.onToggle(i.id)}
                        >
                          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                        </Button>
                      ) : (
                        <span className="hierarchy-toggle-space" />
                      )}
                      <div>
                        {title}
                        {!branch.matches_filters && (
                          <span className="small muted hierarchy-context">
                            Outside filters
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    title
                  )}
                </td>
                <td className="item-type-cell">
                  <ItemType type={i.type} />
                </td>
                <td>
                  <State state={i.state} />
                </td>
                <td>
                  <span className={"priority " + i.priority}>
                    {label(i.priority)}
                  </span>
                </td>
                <td>
                  <Person user={i.assignee} />
                </td>
                {extra && (
                  <>
                    <td className="item-sprint-cell">{i.sprint_name}</td>
                    <td>
                      {i.labels.map((l) => (
                        <span key={l.id} className="label">
                          {l.name}
                        </span>
                      ))}
                    </td>
                    <td className="small nowrap">{when(i.updated_at)}</td>
                  </>
                )}
                {onState && <td>{onState(i)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!props.items.length && (
        <Empty title="No items">No work matches this view.</Empty>
      )}
    </div>
  );
}
export function Pagination({
  data,
  onChange,
  unit = "total",
}: {
  data: Page<unknown>;
  onChange: (offset: number) => void;
  unit?: string;
}) {
  return (
    <div className="footer-row">
      <span>
        {data.total} {unit} · {data.total ? data.offset + 1 : 0}–
        {Math.min(data.offset + data.limit, data.total)}
      </span>
      <div className="row">
        <Button
          className="btn small"
          disabled={data.offset === 0}
          onClick={() => onChange(Math.max(0, data.offset - data.limit))}
        >
          Previous
        </Button>
        <Button
          className="btn small"
          disabled={data.offset + data.limit >= data.total}
          onClick={() => onChange(data.offset + data.limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
const MaterialModal = lazy(() => import("./overlays"));

export function Modal(props: ComponentProps<typeof MaterialModal>) {
  return (
    <Suspense fallback={null}>
      <MaterialModal {...props} />
    </Suspense>
  );
}
export function Field({
  name,
  children,
  hint,
}: {
  name: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{name}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}
export function useWrite() {
  const client = useQueryClient();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function execute<T>(fn: () => Promise<T>, success?: string) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await fn();
      await client.invalidateQueries();
      if (success) setMessage(success);
      return result;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return { execute, error, busy, message, setError, setMessage };
}
export function Activity({
  projectId,
  itemId,
}: {
  projectId: string;
  itemId?: string;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const path =
    (itemId ? `/items/${itemId}/activity` : `/projects/${projectId}/activity`) +
    (cursor ? "?before=" + encodeURIComponent(cursor) : "");
  const q = useData<Page<ActivityEvent> & { next_cursor: string | null }>(
    ["activity", projectId, itemId, cursor],
    path,
    true,
    !cursor,
  );
  return (
    <>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} retry={() => q.refetch()} />
      ) : !q.data?.items.length ? (
        <Empty title="No activity yet">
          Changes to this item will appear here.
        </Empty>
      ) : (
        <>
          <div className="small muted">
            Newest first · Human, agent and automatic changes
          </div>
          {q.data.items.map((e) => (
            <div className="activity-row" key={e.id}>
              <span className="activity-dot" aria-hidden />
              <div className="grow">
                <div>
                  <strong>{e.actor_name}</strong>{" "}
                  <span className="badge">{label(e.actor_kind)}</span>{" "}
                  {label(e.action)}
                </div>
                <div className="small muted">
                  {when(e.created_at)} · {e.interface}
                  {e.cause ? " · " + label(e.cause) : ""}
                </div>
                <details>
                  <summary className="small">Change details</summary>
                  <pre className="event-details">
                    {JSON.stringify(e.changes, null, 2)}
                  </pre>
                  <div className="small muted">
                    Operation {e.operation_id}
                    {e.initiated_by ? " · Initiated by " + e.initiated_by : ""}
                  </div>
                </details>
              </div>
            </div>
          ))}
          <div className="footer-row">
            <span>{cursor ? "Reading older history" : "Latest activity"}</span>
            <div className="row">
              <Button
                className="btn small"
                disabled={cursors.length === 1}
                onClick={() => setCursors((c) => c.slice(0, -1))}
              >
                Newer
              </Button>
              <Button
                className="btn small"
                disabled={!q.data.next_cursor}
                onClick={() => setCursors((c) => [...c, q.data!.next_cursor])}
              >
                Load older
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
