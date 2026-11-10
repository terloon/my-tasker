import type { components } from "./generated";

export type User = components["schemas"]["UserOut"];
export type Project = components["schemas"]["ProjectOut"];
export type Item = components["schemas"]["ItemOut"] & {
  rank: number;
  project_name: string;
};
export type Sprint = components["schemas"]["SprintOut"];
export type Label = components["schemas"]["LabelOut"];
export type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};
export type Grants = Record<string, Record<string, boolean>>;
export type Prefs = {
  appearance: "light" | "dark" | "system";
  accent: string;
  version: number;
};
export type Comment = {
  id: string;
  body: string;
  version: number;
  author: User;
  last_editor: User;
  created_at: string;
  updated_at: string;
};
export type Attachment = {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  version: number;
  preview_kind: string | null;
  storage_state: string;
};
export type LinkEdge = {
  id: string;
  relationship: string;
  kind: string;
  version: number;
  source_id: string;
  target_id: string;
  item: Item;
};
export type Impact = {
  version: number;
  impact_revision: string;
  affected_items: {
    link_id: string;
    item: Item;
    remaining_blockers: number;
    will_move_to_open: boolean;
  }[];
};
export type Event = {
  id: string;
  actor_name: string;
  actor_kind: string;
  action: string;
  entity_id: string;
  interface: string;
  created_at: string;
  changes: Record<string, unknown>;
  operation_id: string;
  cause: string | null;
  initiated_by: string | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    version?: number;
    key?: string;
  } = {},
): Promise<T> {
  const headers = new Headers();
  const csrf = document.cookie
    .split("; ")
    .find((c) => c.startsWith("lp_csrf="))
    ?.split("=")
    .slice(1)
    .join("=");
  if (csrf) headers.set("X-CSRF-Token", decodeURIComponent(csrf));
  if (options.version !== undefined)
    headers.set("If-Match", String(options.version));
  if (options.key) headers.set("Idempotency-Key", options.key);
  const isFile = options.body instanceof FormData;
  if (options.body !== undefined && !isFile)
    headers.set("Content-Type", "application/json");
  const result = await fetch("/api/v1" + path, {
    method: options.method || "GET",
    credentials: "same-origin",
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFile
          ? (options.body as FormData)
          : JSON.stringify(options.body),
  });
  if (!result.ok) {
    const error = await result
      .json()
      .catch(() => ({ message: "The local service is unavailable." }));
    if (
      result.status === 401 &&
      !["/auth/login", "/auth/me", "/auth/token"].includes(path)
    )
      window.dispatchEvent(new CustomEvent("planner-session-expired"));
    throw new ApiError(
      result.status,
      error.code || "request_failed",
      error.message || "The request failed.",
      error.details,
    );
  }
  return result.status === 204 ? (undefined as T) : result.json();
}

export function query(params: Record<string, unknown>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false)
      (Array.isArray(v) ? v : [v]).forEach((x) => p.append(k, String(x)));
  });
  return p.toString();
}

export async function allPages<T>(path: string): Promise<Page<T>> {
  const [base, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("limit", "200");
  const items: T[] = [];
  let offset = 0;
  while (true) {
    params.set("offset", String(offset));
    const result = await api<Page<T>>(base + "?" + params);
    items.push(...result.items);
    offset += result.items.length;
    if (offset >= result.total || !result.items.length) break;
  }
  return {
    items,
    total: items.length,
    offset: 0,
    limit: Math.max(items.length, 1),
  };
}
export async function reorderItem(item: Item, delta: number) {
  const all = await allPages<Item>(
    "/items?" +
      query({
        project_id: [item.project_id],
        sprint_id: item.sprint_id ? [item.sprint_id] : [],
        backlog: !item.sprint_id,
        sort: "rank",
        direction: "asc",
      }),
  );
  const index = all.items.findIndex((i) => i.id === item.id);
  if (index < 0 || all.items[index].version !== item.version)
    throw new ApiError(
      412,
      "version_conflict",
      "This item changed. Reload before reordering.",
    );
  if (index + delta < 0 || index + delta >= all.items.length) return;
  [all.items[index], all.items[index + delta]] = [
    all.items[index + delta],
    all.items[index],
  ];
  return api(`/projects/${item.project_id}/item-order`, {
    method: "PUT",
    body: {
      sprint_id: item.sprint_id,
      ordered_ids: all.items.map((i) => i.id),
      versions: Object.fromEntries(all.items.map((i) => [i.id, i.version])),
    },
  });
}

export const states = [
  "open",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
] as const;
export const types = ["story", "task", "bug"] as const;
export const priorities = ["none", "low", "medium", "high", "urgent"] as const;
export const label = (s: string) =>
  s === "in_progress"
    ? "In progress"
    : s === "planned"
      ? "Not started"
      : s.charAt(0).toUpperCase() + s.slice(1).replaceAll("_", " ");
export const can = (
  p: { permissions: Grants } | null | undefined,
  resource: string,
  action = "view",
) =>
  !!p?.permissions.project?.view &&
  !!p?.permissions[resource]?.view &&
  !!p?.permissions[resource]?.[action] &&
  (!["comment", "attachment"].includes(resource) ||
    !!p?.permissions.item?.view);
export const when = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

export function uploadAttachment(
  itemId: string,
  file: File,
  key: string,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/v1/items/${itemId}/attachments`);
    request.setRequestHeader("Idempotency-Key", key);
    const csrf = document.cookie
      .split("; ")
      .find((c) => c.startsWith("lp_csrf="))
      ?.slice(8);
    if (csrf)
      request.setRequestHeader("X-CSRF-Token", decodeURIComponent(csrf));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
    };
    const abort = () => request.abort();
    signal.addEventListener("abort", abort, { once: true });
    request.onloadend = () => signal.removeEventListener("abort", abort);
    request.onerror = () =>
      reject(new Error("Upload failed. Check the connection and retry."));
    request.onabort = () =>
      reject(new Error("Upload cancelled. You can retry safely."));
    request.onload = () => {
      let body;
      try {
        body = JSON.parse(request.responseText);
      } catch {
        reject(new Error("The local service is unavailable."));
        return;
      }
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(body);
      } else {
        if (request.status === 401)
          window.dispatchEvent(new CustomEvent("planner-session-expired"));
        reject(
          new ApiError(
            request.status,
            body.code,
            body.message || "Upload failed.",
            body.details,
          ),
        );
      }
    };
    const form = new FormData();
    form.append("file", file);
    request.send(form);
    if (signal.aborted) request.abort();
  });
}
