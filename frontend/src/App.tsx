import SelectField from "./SelectField";
import { ActionMenu, Button } from "./controls";
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type Page,
  type Prefs,
  type Project,
  type User,
} from "./api/client";
import {
  ConfirmHost,
  Empty,
  ErrorBox,
  Field,
  Heading,
  Loading,
  Modal,
  Person,
  Workspace,
  useCollection,
  useData,
  useItem,
  useWorkspace,
  useWrite,
} from "./ui";
import {
  Home,
  ItemList,
  Planning,
  ProjectOverview,
  SprintBoard,
} from "./pages";
import ItemDetail from "./ItemDetail";
import { PasswordDialog, Permissions, Users } from "./admin";

const itemDetailPath = "/projects/:id/items/:itemId";

export const accentColors: Record<string, [string, string]> = {
  Blue: ["#1d4ed8", "#60a5fa"],
  Indigo: ["#4338ca", "#a5b4fc"],
  Purple: ["#7e22ce", "#c084fc"],
  Pink: ["#be185d", "#f9a8d4"],
  Red: ["#b91c1c", "#fca5a5"],
  Orange: ["#c2410c", "#fdba74"],
  Amber: ["#92400e", "#fcd34d"],
  Green: ["#15803d", "#86efac"],
  Teal: ["#0f766e", "#5eead4"],
  Slate: ["#475569", "#cbd5e1"],
};
function theme(p: Pick<Prefs, "appearance" | "accent">) {
  const dark =
    p.appearance === "dark" ||
    (p.appearance === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const color = (accentColors[p.accent] || accentColors.Blue)[dark ? 1 : 0];
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty(
    "--accent-soft",
    `color-mix(in srgb, ${color} ${dark ? 12 : 8}%, ${dark ? "#151c28" : "#ffffff"})`,
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setup, setSetup] = useState<boolean | null>(null);
  const [bootError, setBootError] = useState<unknown>();
  const [expired, setExpired] = useState(false);
  const [selection, setSelection] = useState("");
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const itemMatch = useMatch(itemDetailPath);
  const item = useItem(itemMatch?.params.itemId, { observeOnly: true });
  const currentItem = item.error ? undefined : item.data;
  const qc = useQueryClient();
  const me = useData<User>(["me"], "/auth/me", !!user);
  const projects = useCollection<Project>(
    ["projects"],
    "/projects?limit=200",
    !!user,
  );
  const prefs = useData<Prefs>(["preferences"], "/me/preferences", !!user);
  useEffect(() => {
    let active = true;
    api<{ setup_required: boolean }>("/setup")
      .then(async (s) => {
        if (!active) return;
        setSetup(s.setup_required);
        if (!s.setup_required) {
          try {
            const u = await api<User>("/auth/me");
            if (active) setUser(u);
          } catch (e) {
            if (!(e instanceof ApiError && e.status === 401)) setBootError(e);
          }
        }
      })
      .catch(setBootError);
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (me.data && user) setUser(me.data);
  }, [me.data]);
  useEffect(() => {
    const fn = () => {
      setExpired(true);
    };
    window.addEventListener("planner-session-expired", fn);
    return () => window.removeEventListener("planner-session-expired", fn);
  }, []);
  useEffect(() => {
    if (prefs.data) {
      theme(prefs.data);
      localStorage.setItem("planner-appearance", JSON.stringify(prefs.data));
      if (user)
        localStorage.setItem(
          "planner-appearance:" + user.id,
          JSON.stringify(prefs.data),
        );
    }
    const handler = () => prefs.data && theme(prefs.data);
    matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      handler,
    );
    return () =>
      matchMedia("(prefers-color-scheme: dark)").removeEventListener(
        "change",
        handler,
      );
  }, [prefs.data, user?.id]);
  const fromPath = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const all = projects.data?.items || [];
  const project =
    all.find((p) => p.id === (fromPath || selection)) || all[0] || null;
  function logout() {
    api("/auth/logout", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        setUser(null);
        qc.clear();
        localStorage.removeItem("planner-appearance");
        theme({ appearance: "system", accent: "Blue" });
        nav("/login");
      });
  }
  function login(u: User) {
    const restoring = expired && user?.id === u.id;
    setUser(u);
    setSetup(false);
    setExpired(false);
    if (restoring) qc.invalidateQueries();
    else qc.clear();
    if (restoring) return;
    nav(
      location.pathname === "/login" || location.pathname === "/setup"
        ? "/"
        : location.pathname,
    );
  }
  if (bootError)
    return (
      <main className="page">
        <Heading title="Could not connect" />
        <ErrorBox error={bootError} retry={() => window.location.reload()} />
      </main>
    );
  if (setup === null)
    return (
      <main className="page">
        <Loading />
      </main>
    );
  if (!user)
    return (
      <>
        <Auth setup={setup} onLogin={login} />
        {expired && (
          <Modal
            title="Your session has expired"
            onClose={() => setExpired(false)}
            footer={
              <Button className="btn primary" onClick={() => setExpired(false)}>
                Sign in
              </Button>
            }
          >
            <p>
              Sign in again to continue. Unsaved changes were not submitted.
            </p>
          </Modal>
        )}
      </>
    );
  const active =
    location.pathname === "/users" || location.pathname.includes("/admin/users")
      ? "Users"
      : location.pathname.includes("/permissions")
        ? "Permissions"
        : location.pathname.includes("/planning")
          ? "Planning"
          : location.pathname.includes("/sprints/")
            ? "Sprint"
            : location.pathname === "/items"
              ? "List"
              : location.pathname.includes("/items/")
                ? "Items"
                : location.pathname === "/settings/appearance"
                  ? "Appearance"
                  : location.pathname === "/settings/account"
                    ? "Account"
                    : location.pathname.startsWith("/projects/")
                      ? "Project overview"
                      : "Home";
  const pid = project?.id;
  const breadcrumbProject =
    active === "Home" ? null : (currentItem?.project_name ?? project?.name);
  const links = [
    ["Home", "/", "⌂"],
    ["Project overview", pid ? "/projects/" + pid : "/", "▧"],
    ["Planning", pid ? `/projects/${pid}/planning` : "/", "☷"],
    ["List", pid ? "/items?project_id=" + pid : "/items", "≡"],
    ["Sprint", pid ? `/projects/${pid}/current` : "/", "▥"],
  ];
  return (
    <Workspace.Provider
      value={{
        user,
        projects: all,
        project,
        selectProject: setSelection,
        logout,
      }}
    >
      <ConfirmHost key={user.id} />
      <div
        key={user.id}
        hidden={expired}
        className={"app " + (menu ? "menu-open" : "")}
      >
        <aside className="sidebar">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden>
              ✓
            </span>
            Local Planner
          </Link>
          <SelectField
            title="Workspace"
            value={pid || ""}
            options={
              all.length
                ? all.map((p) => ({ value: p.id, label: p.name }))
                : [{ value: "", label: "No projects" }]
            }
            onChange={(next) => {
              setSelection(next);
              nav("/projects/" + next);
              setMenu(false);
            }}
          />
          <nav className="nav-group" aria-label="Main navigation">
            {links.map(([name, to, glyph]) => (
              <Link
                key={name}
                className={"nav-link " + (active === name ? "active" : "")}
                to={to}
                onClick={() => setMenu(false)}
              >
                <span className="nav-symbol" aria-hidden>
                  {glyph}
                </span>
                {name}
              </Link>
            ))}
          </nav>
          {user.is_admin && (
            <div className="nav-group">
              <div className="nav-label">Administration</div>
              <Link
                className={"nav-link " + (active === "Users" ? "active" : "")}
                to="/admin/users"
              >
                ♙ &nbsp; Users
              </Link>
              {pid && (
                <Link
                  className={
                    "nav-link " + (active === "Permissions" ? "active" : "")
                  }
                  to={`/projects/${pid}/settings/permissions`}
                >
                  ⚿ &nbsp; Permissions
                </Link>
              )}
            </div>
          )}
          <div className="sidebar-bottom">
            <Link
              className={
                "nav-link " + (active === "Appearance" ? "active" : "")
              }
              to="/settings/appearance"
            >
              Appearance
            </Link>
            <Link
              className={"nav-link " + (active === "Account" ? "active" : "")}
              to="/settings/account"
            >
              Account
            </Link>
            <div className="account">
              <Person user={user} />
            </div>
          </div>
        </aside>
        <div className="app-main">
          <header className="header">
            <div className="row header-context">
              <Button
                className="btn ghost mobile-menu"
                aria-label="Toggle navigation"
                onClick={() => setMenu(!menu)}
              >
                ☰
              </Button>
              <div className="breadcrumb">
                {breadcrumbProject && (
                  <>
                    <span
                      className="breadcrumb-project"
                      title={breadcrumbProject}
                    >
                      {breadcrumbProject}
                    </span>
                    <span aria-hidden="true">/</span>
                  </>
                )}
                <strong className={currentItem ? "header-item-key" : undefined}>
                  {currentItem?.key ?? active}
                </strong>
              </div>
            </div>
            <div className="row header-account">
              <Link
                className="btn ghost icon-btn"
                aria-label="Appearance settings"
                to="/settings/appearance"
              >
                ◐
              </Link>
              <ActionMenu
                label="Account menu"
                className="avatar"
                trigger={user.display_name.slice(0, 2).toUpperCase()}
                actions={[
                  { label: "Account", to: "/settings/account" },
                  { label: "Sign out", onSelect: logout },
                ]}
              />
            </div>
          </header>
          <main className="page" key={user.id}>
            {projects.error && (
              <ErrorBox
                error={projects.error}
                retry={() => projects.refetch()}
              />
            )}
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects/:id" element={<ProjectOverview />} />
              <Route path="/projects/:id/planning" element={<Planning />} />
              <Route path="/projects/:id/current" element={<CurrentSprint />} />
              <Route
                path="/projects/:id/sprints/:sprintId"
                element={<SprintBoard />}
              />
              <Route path="/items" element={<ItemList />} />
              <Route path={itemDetailPath} element={<ItemDetail />} />
              <Route path="/admin/users" element={<Users />} />
              <Route
                path="/projects/:id/settings/permissions"
                element={<Permissions />}
              />
              <Route path="/settings/appearance" element={<Appearance />} />
              <Route path="/settings/account" element={<Account />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/setup" element={<Navigate to="/" replace />} />
              <Route
                path="*"
                element={
                  <Empty title="Page not found">
                    <Link to="/">Back to Home</Link>
                  </Empty>
                }
              />
            </Routes>
          </main>
        </div>
      </div>
      {expired && (
        <Modal
          title="Your session has expired"
          dismissible={false}
          onClose={() => {}}
        >
          <p>
            Sign in again to continue. Your unsaved work stays in this tab for
            the same account.
          </p>
          <Auth setup={false} onLogin={login} />
        </Modal>
      )}
    </Workspace.Provider>
  );
}

function Auth({
  setup,
  onLogin,
}: {
  setup: boolean;
  onLogin: (user: User) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark" aria-hidden>
            ✓
          </span>
          Local Planner
        </div>
        <h1>{setup ? "Create your administrator" : "Welcome back"}</h1>
        <p className="muted" style={{ marginTop: 10 }}>
          {setup
            ? "Start your local workspace with a username and password."
            : "Sign in to your local workspace."}
        </p>
        <form
          className="panel stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              if (setup && password !== confirmation)
                throw new Error("Passwords do not match.");
              const result = await api<{ user: User }>(
                setup ? "/setup" : "/auth/login",
                { method: "POST", body: { username, password } },
              );
              setPassword("");
              setConfirmation("");
              onLogin(result.user);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!!error && <ErrorBox error={error} />}
          <Field name="Username">
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={setup ? 3 : 1}
              maxLength={64}
            />
          </Field>
          <Field
            name="Password"
            hint={setup ? "Use at least 12 characters." : undefined}
          >
            <input
              type={show ? "text" : "password"}
              autoComplete={setup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={setup ? 12 : 1}
              maxLength={256}
            />
          </Field>
          {setup && (
            <Field name="Confirm password">
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </Field>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />
            Show password
          </label>
          <Button type="submit" className="btn primary full" disabled={busy}>
            {busy ? "Please wait…" : setup ? "Create administrator" : "Sign in"}
          </Button>
        </form>
        <p className="auth-footer">
          {setup
            ? "This account manages users and project access."
            : "Runs locally. Your projects stay on this installation."}
        </p>
        <div
          className="row"
          style={{ justifyContent: "center", marginTop: 16 }}
        >
          <Button
            className="btn ghost small"
            onClick={() =>
              theme({
                appearance:
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
                accent: "Blue",
              })
            }
          >
            ◐ Toggle appearance
          </Button>
        </div>
      </div>
    </main>
  );
}

function CurrentSprint() {
  const { id } = useParams();
  const q = useData<Page<import("./api/client").Sprint>>(
    ["current", id],
    `/projects/${id}/sprints?state=active`,
  );
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  return q.data?.items[0] ? (
    <Navigate to={`/projects/${id}/sprints/${q.data.items[0].id}`} replace />
  ) : (
    <Empty title="No active sprint">
      <Link className="btn" to={`/projects/${id}/planning`}>
        Open Planning
      </Link>
    </Empty>
  );
}

import { useParams } from "react-router-dom";
function Appearance() {
  const q = useData<Prefs>(["preferences"], "/me/preferences");
  const w = useWrite();
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const p = q.data!;
  function save(values: Partial<Prefs>) {
    w.execute(
      () =>
        api<Prefs>("/me/preferences", {
          method: "PATCH",
          version: p.version,
          body: values,
        }),
      "Saved",
    ).catch(() => {});
  }
  return (
    <>
      <Heading
        title="Appearance"
        description="Your appearance and accent preferences are saved to your account."
      />
      {!!w.error && <ErrorBox error={w.error} retry={() => q.refetch()} />}
      <section>
        <div className="section-head">
          <h2>Mode</h2>
          <span role="status" className="small muted">
            {w.busy ? "Saving…" : w.message}
          </span>
        </div>
        <div className="mode-grid">
          {(["light", "dark", "system"] as const).map((mode) => (
            <Button
              key={mode}
              disabled={w.busy}
              className={
                "mode-choice " + (p.appearance === mode ? "selected" : "")
              }
              aria-pressed={p.appearance === mode}
              onClick={() => save({ appearance: mode })}
            >
              <div className={"mini-window " + mode} aria-hidden>
                <span />
              </div>
              {label(mode)}
            </Button>
          ))}
        </div>
        <p className="small muted">System follows your device's appearance.</p>
      </section>
      <section className="section">
        <h2>Accent color</h2>
        <div className="swatches section">
          {Object.entries(accentColors).map(([name, colors]) => (
            <Button
              key={name}
              className="swatch"
              aria-pressed={p.accent === name}
              disabled={w.busy}
              onClick={() => save({ accent: name })}
            >
              <span
                className="swatch-dot"
                style={
                  {
                    "--swatch":
                      colors[
                        document.documentElement.dataset.theme === "dark"
                          ? 1
                          : 0
                      ],
                  } as React.CSSProperties
                }
                aria-hidden
              />
              {name}
            </Button>
          ))}
        </div>
      </section>
      <div className="panel theme-example">
        <h3>Preview</h3>
        <div className="row" style={{ margin: "16px 0" }}>
          {states.map((state) => (
            <span className={"state " + state} key={state}>
              {state === "in_progress" ? "In progress" : label(state)}
            </span>
          ))}
        </div>
        <Button className="btn primary">Primary action</Button>{" "}
        <Button className="btn">Secondary action</Button>
      </div>
    </>
  );
}

import { label, states } from "./api/client";
function Account() {
  const { user, logout } = useWorkspace();
  const [password, setPassword] = useState(false);
  return (
    <>
      <Heading
        title="Account"
        description="Your identity and sign-in settings."
      />
      <div className="stack" style={{ maxWidth: 720 }}>
        <section className="panel">
          <h2>Signed in as {user.display_name}</h2>
          <Person user={user} />
          <div className="small muted">
            {user.username} · {user.is_admin ? "Administrator" : "User"}
          </div>
        </section>
        <section className="panel between">
          <div>
            <h2>Password</h2>
            <p className="small muted">
              Changing your password signs out existing sessions.
            </p>
          </div>
          <Button className="btn" onClick={() => setPassword(true)}>
            Change password
          </Button>
        </section>
        <section className="panel between">
          <h2>Sign out</h2>
          <Button className="btn" onClick={logout}>
            Sign out
          </Button>
        </section>
      </div>
      {password && (
        <PasswordDialog user={user} onClose={() => setPassword(false)} />
      )}
    </>
  );
}
