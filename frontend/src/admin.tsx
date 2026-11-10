import { ask } from "./ui";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, label, type Grants, type Page, type User } from "./api/client";
import {
  Empty,
  ErrorBox,
  Field,
  Heading,
  Loading,
  Modal,
  Pagination,
  Person,
  useData,
  useWorkspace,
  useWrite,
} from "./ui";

export function Users() {
  const { user } = useWorkspace();
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [credential, setCredential] = useState<User | null>(null);
  const q = useData<Page<User>>(
    ["users", offset, kind, status],
    `/users?offset=${offset}${kind ? "&kind=" + kind : ""}${status ? "&enabled=" + status : ""}`,
    !!user.is_admin,
  );
  if (!user.is_admin)
    return (
      <Empty title="Access denied">Administrator access is required.</Empty>
    );
  return (
    <>
      <Heading
        title="Users"
        description="Human and agent accounts. Project access is granted separately."
        actions={
          <button className="btn primary" onClick={() => setCreate(true)}>
            + Create user
          </button>
        }
      />
      <div className="filters">
        <select
          className="btn"
          aria-label="Account kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All types</option>
          <option value="human">Human</option>
          <option value="agent">Agent</option>
        </select>
        <select
          className="btn"
          aria-label="Account status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All statuses</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <>
          <div className="panel flush table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Type</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Person user={u} />
                    </td>
                    <td className="mono small">{u.username}</td>
                    <td>{label(u.kind)}</td>
                    <td>{u.is_admin ? "Administrator" : "User"}</td>
                    <td className={u.enabled ? "success-text" : "muted"}>
                      {u.enabled ? "Enabled" : "Disabled"}
                    </td>
                    <td>
                      <button
                        className="btn small ghost"
                        onClick={() => setSelected(u)}
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.data && <Pagination data={q.data} onChange={setOffset} />}
        </>
      )}
      {create && (
        <UserEditor
          onClose={() => setCreate(false)}
          onCreated={(u) => {
            setCreate(false);
            if (u.generated_password) setCredential(u);
          }}
        />
      )}{" "}
      {selected && (
        <UserDetail
          user={selected}
          onClose={() => setSelected(null)}
          onCredential={(u) => {
            setSelected(null);
            setCredential(u);
          }}
        />
      )}{" "}
      {credential && (
        <Credentials user={credential} onClose={() => setCredential(null)} />
      )}
    </>
  );
}

function UserEditor({
  initial,
  onClose,
  onCreated,
}: {
  initial?: User;
  onClose: () => void;
  onCreated: (u: User) => void;
}) {
  const [kind, setKind] = useState(initial?.kind || "human");
  const [username, setUsername] = useState("");
  const [name, setName] = useState(initial?.display_name || "");
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(initial?.is_admin || false);
  const w = useWrite();
  async function save() {
    const body = initial
      ? { display_name: name, is_admin: admin }
      : kind === "agent"
        ? { kind, display_name: name || undefined }
        : { kind, username, display_name: name, password, is_admin: admin };
    const u = await w.execute(() =>
      api<User>(initial ? `/users/${initial.id}` : "/users", {
        method: initial ? "PATCH" : "POST",
        version: initial?.version,
        body,
      }),
    );
    onCreated(u);
    onClose();
  }
  return (
    <Modal
      title={initial ? "Edit user" : "Create user"}
      onClose={onClose}
      dirty={!!name || !!username || !!password}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={
              w.busy ||
              (kind === "human" &&
                (!name.trim() ||
                  (!initial && (!username.trim() || password.length < 12))))
            }
            onClick={() => save().catch(() => {})}
          >
            {w.busy
              ? "Saving…"
              : initial
                ? "Save details"
                : kind === "agent"
                  ? "Create agent"
                  : "Create human"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}{" "}
        {!initial && (
          <Field name="User type">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as "human" | "agent");
                setAdmin(false);
              }}
            >
              <option value="human">Human</option>
              <option value="agent">Agent</option>
            </select>
          </Field>
        )}
        <Field name={"Display name" + (kind === "agent" ? " (optional)" : "")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={300}
          />
        </Field>
        {kind === "agent" ? (
          <div className="callout">
            A unique username and UUID password are generated. The password is
            shown once after creation.
          </div>
        ) : (
          <>
            {!initial && (
              <>
                <Field name="Username">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={64}
                  />
                </Field>
                <Field name="Initial password" hint="At least 12 characters.">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={256}
                  />
                </Field>
              </>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={admin}
                onChange={(e) => setAdmin(e.target.checked)}
              />
              Administrator — manages users and all projects
            </label>
          </>
        )}
        <p className="small muted">
          New users have no project access until permissions are granted.
        </p>
      </div>
    </Modal>
  );
}

function UserDetail({
  user: initial,
  onClose,
  onCredential,
}: {
  user: User;
  onClose: () => void;
  onCredential: (u: User) => void;
}) {
  const q = useData<User>(["user", initial.id], `/users/${initial.id}`);
  const user = q.data || initial;
  const [edit, setEdit] = useState(false);
  const [reset, setReset] = useState(false);
  const w = useWrite();
  return (
    <>
      <Modal
        drawer
        title={user.display_name}
        subtitle={`${label(user.kind)} · ${user.is_admin ? "Administrator" : "User"}`}
        onClose={onClose}
        footer={
          <button className="btn" onClick={onClose}>
            Close
          </button>
        }
      >
        <div className="stack">
          {!!w.error && <ErrorBox error={w.error} />}
          <div className="field">
            <span>Username</span>
            <div className="mono">{user.username}</div>
          </div>
          <div className="field">
            <span>Public user ID</span>
            <div className="mono small wrap">{user.id}</div>
            <span className="hint">This is not a password.</span>
          </div>
          <p className={user.enabled ? "success-text" : "muted"}>
            {user.enabled ? "Enabled" : "Disabled"}
          </p>
          <button className="btn" onClick={() => setEdit(true)}>
            Edit details
          </button>
          {user.kind === "agent" ? (
            <button
              className="btn"
              onClick={async () => {
                if (
                  await ask(
                    "Rotate this agent password? The old password and all sessions/tokens will stop working.",
                  )
                )
                  w.execute(() =>
                    api<User>(`/users/${user.id}/rotate-agent-password`, {
                      method: "POST",
                      version: user.version,
                    }),
                  )
                    .then(onCredential)
                    .catch(() => {});
              }}
            >
              Rotate agent password
            </button>
          ) : (
            <button className="btn" onClick={() => setReset(true)}>
              Reset password
            </button>
          )}
          <button
            className={"btn " + (user.enabled ? "danger" : "")}
            onClick={async () => {
              if (
                await ask(
                  `${user.enabled ? "Disable" : "Enable"} ${user.display_name}? ${user.enabled ? "Existing sessions and tokens will be revoked. History is retained." : ""}`,
                )
              )
                w.execute(() =>
                  api(`/users/${user.id}`, {
                    method: "PATCH",
                    version: user.version,
                    body: { enabled: !user.enabled },
                  }),
                ).catch(() => {});
            }}
          >
            {user.enabled ? "Disable account" : "Enable account"}
          </button>
          <p className="small muted">
            The last enabled human administrator cannot be disabled or demoted.
          </p>
        </div>
      </Modal>
      {edit && (
        <UserEditor
          initial={user}
          onClose={() => setEdit(false)}
          onCreated={() => setEdit(false)}
        />
      )}{" "}
      {reset && (
        <PasswordDialog
          user={user}
          adminReset
          onClose={() => setReset(false)}
        />
      )}
    </>
  );
}

function Credentials({ user, onClose }: { user: User; onClose: () => void }) {
  const [copied, setCopied] = useState("");
  async function copy(value: string, which: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
    } catch {
      setCopied("Select and copy the text manually.");
    }
  }
  return (
    <Modal
      title="Agent credentials"
      subtitle={user.display_name}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="stack">
        <div className="callout">
          Copy the UUID password now. It cannot be retrieved after closing. If
          this was a rotation, previous sessions/tokens have been revoked.
        </div>
        <Field name="Username">
          <input readOnly value={user.username} />
        </Field>
        <button
          className="btn small"
          onClick={() => copy(user.username, "Username copied")}
        >
          Copy username
        </button>
        <Field name="UUID password">
          <textarea
            readOnly
            className="secret"
            value={user.generated_password || ""}
          />
        </Field>
        <button
          className="btn small"
          onClick={() => copy(user.generated_password || "", "Password copied")}
        >
          Copy UUID password
        </button>
        <p className="small" role="status">
          {copied}
        </p>
        <p className="small muted">
          Grant project permissions before using REST or MCP. Each user starts
          with no project access.
        </p>
      </div>
    </Modal>
  );
}

export function Permissions() {
  const { id } = useParams();
  const { user } = useWorkspace();
  const q = useData<{
    grant_revision: number;
    users: { user: User; permissions: Grants; explicit: Grants }[];
  }>(["permissions", id], `/projects/${id}/permissions`, !!user.is_admin);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<Grants>({});
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const w = useWrite();
  const row = q.data?.users.find((r) => r.user.id === selected);
  const resources = ["project", "sprint", "item", "comment", "attachment"];
  const actions = ["view", "create", "update", "delete"];
  function load(userId: string) {
    const r = q.data?.users.find((r) => r.user.id === userId);
    setSelected(userId);
    setDraft(
      Object.fromEntries(
        resources.map((resource) => [
          resource,
          Object.fromEntries(
            actions.map((a) => [a, !!r?.explicit[resource]?.[a]]),
          ),
        ]),
      ),
    );
    setRevision(q.data!.grant_revision);
    setDirty(false);
  }
  useEffect(() => {
    if (q.data && !selected)
      load(
        q.data.users.find((u) => !u.user.is_admin)?.user.id ||
          q.data.users[0]?.user.id,
      );
  }, [q.data]);
  async function toggle(resource: string, action: string) {
    const d = structuredClone(draft);
    const next = !d[resource][action];
    if (!next && action === "view") {
      if (resource === "project") {
        if (
          !(await ask(
            "Removing Project View clears all project grants. Continue?",
          ))
        )
          return;
        resources.forEach((r) => actions.forEach((a) => (d[r][a] = false)));
      } else {
        if (
          actions.some((a) => a !== "view" && d[resource][a]) &&
          !(await ask(
            "Removing View also clears this resource’s write permissions. Continue?",
          ))
        )
          return;
        actions.forEach((a) => (d[resource][a] = false));
        if (resource === "item") {
          if (
            !(await ask(
              "Removing Item View also clears Comments and Attachments access. Continue?",
            ))
          )
            return;
          ["comment", "attachment"].forEach((r) =>
            actions.forEach((a) => (d[r][a] = false)),
          );
        }
      }
    } else {
      d[resource][action] = next;
      if (next) {
        d[resource].view = true;
        d.project.view = true;
        if (["comment", "attachment"].includes(resource)) d.item.view = true;
      }
    }
    setDraft(d);
    setDirty(true);
  }
  if (!user.is_admin)
    return (
      <Empty title="Access denied">Administrator access is required.</Empty>
    );
  return (
    <>
      <Heading
        title="Project permissions"
        description="Choose a user, then grant only the project access they need."
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <div className="permission-layout">
          <aside className="panel">
            {q.data?.users.map((r) => (
              <button
                className={
                  "user-choice " + (selected === r.user.id ? "selected" : "")
                }
                key={r.user.id}
                onClick={async () => {
                  if (
                    !dirty ||
                    (await ask("Discard unsaved permission changes?"))
                  )
                    load(r.user.id);
                }}
              >
                <strong>{r.user.display_name}</strong>
                <div className="small muted">
                  {label(r.user.kind)}
                  {r.user.is_admin ? " · Administrator" : ""}
                </div>
              </button>
            ))}
          </aside>
          <section className="panel stack">
            {!!w.error && (
              <ErrorBox
                error={w.error}
                retry={() => {
                  q.refetch().then(() => setSelected(""));
                }}
              />
            )}
            <div>
              <h2>{row?.user.display_name}</h2>
              <p className="small muted">{row?.user.username}</p>
            </div>
            <div className="callout">
              {row?.user.is_admin
                ? "Administrators have full installation access. Explicit grants do not restrict that access."
                : "Project View is required. Write permissions also require View. Comments/files require Item View."}
            </div>
            <div className="table-wrap">
              <table className="table permission-table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    {actions.map((a) => (
                      <th key={a}>{label(a)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r}>
                      <th>{label(r)}</th>
                      {actions.map((a) => (
                        <td key={a}>
                          {r === "project" &&
                          ["create", "delete"].includes(a) ? (
                            <span className="small muted">Admin only</span>
                          ) : (
                            <input
                              type="checkbox"
                              aria-label={`${label(r)} ${label(a)}`}
                              disabled={!!row?.user.is_admin}
                              checked={
                                row?.user.is_admin ? true : !!draft[r]?.[a]
                              }
                              onChange={() => toggle(r, a)}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dirty && (
              <p role="status" className="small">
                Unsaved permission changes
              </p>
            )}
            <div className="between">
              <button
                className="btn ghost danger-text"
                disabled={!selected || !!row?.user.is_admin || w.busy}
                onClick={async () => {
                  if (
                    await ask(
                      "Revoke this user’s explicit access to this project?",
                    )
                  )
                    w.execute(() =>
                      api(
                        `/projects/${id}/permissions/${selected}?expected_revision=${q.data!.grant_revision}`,
                        { method: "DELETE" },
                      ),
                    )
                      .then(() => {
                        setSelected("");
                        setDirty(false);
                      })
                      .catch(() => {});
                }}
              >
                Revoke access
              </button>
              <div className="row">
                <button
                  className="btn"
                  disabled={!dirty}
                  onClick={() => load(selected)}
                >
                  Discard changes
                </button>
                <button
                  className="btn primary"
                  disabled={!dirty || w.busy || !!row?.user.is_admin}
                  onClick={() =>
                    w
                      .execute(() =>
                        api(`/projects/${id}/permissions/${selected}`, {
                          method: "PUT",
                          body: { expected_revision: revision, grants: draft },
                        }),
                      )
                      .then(() => {
                        setSelected("");
                        setDirty(false);
                      })
                      .catch(() => {})
                  }
                >
                  Save permissions
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function PasswordDialog({
  user,
  adminReset = false,
  onClose,
}: {
  user: User;
  adminReset?: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const w = useWrite();
  const { logout } = useWorkspace();
  return (
    <Modal
      title={adminReset ? "Reset human password" : "Change password"}
      subtitle={user.username}
      onClose={onClose}
      dirty={!!password}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={
              w.busy ||
              password.length < 12 ||
              password !== confirmPassword ||
              (!adminReset && !current)
            }
            onClick={() =>
              w
                .execute(() =>
                  api(
                    adminReset
                      ? `/users/${user.id}/reset-password`
                      : "/auth/password",
                    {
                      method: adminReset ? "POST" : "PUT",
                      version: user.version,
                      body: adminReset
                        ? { password }
                        : { current_password: current, new_password: password },
                    },
                  ),
                )
                .then(() => {
                  onClose();
                  if (!adminReset) logout();
                })
                .catch(() => {})
            }
          >
            {adminReset ? "Reset password" : "Change password"}
          </button>
        </>
      }
    >
      <div className="stack">
        {!!w.error && <ErrorBox error={w.error} />}{" "}
        {!adminReset && (
          <Field name="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
        )}
        <Field name="New password" hint="Use at least 12 characters.">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field name="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {password !== confirmPassword && confirmPassword && (
          <p className="danger-text">Passwords do not match.</p>
        )}
        <p className="small muted">
          Existing sessions and API tokens are revoked.{" "}
          {adminReset
            ? "The user must sign in again."
            : "You will be asked to sign in again."}
        </p>
      </div>
    </Modal>
  );
}
