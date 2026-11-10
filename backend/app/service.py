"""Shared transactional domain services for REST and MCP."""

import base64
import hashlib
import json
import re
import secrets
import time
from datetime import UTC, datetime
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from sqlalchemy import delete, func, insert, select, update

from . import models as m
from .errors import DomainError, require

passwords = PasswordHasher()


def uid():
    return str(uuid4())


def now():
    return datetime.now(UTC).isoformat(timespec="microseconds")


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def fingerprint(value):
    return digest(json.dumps(value, sort_keys=True, separators=(",", ":")))


def public_user(user):
    return {k: v for k, v in user.items() if k not in ("password_hash", "session_kind")}


def check_version(row, expected):
    require(
        expected is not None, 428, "precondition_required", "Reload this record before changing it."
    )
    require(
        row["version"] == expected,
        412,
        "version_conflict",
        "This record changed. Reload it before saving.",
        {"current_version": row["version"]},
    )


def page(rows, offset=0, limit=50):
    offset, limit = max(0, offset), min(200, max(1, limit))
    return {
        "items": rows[offset : offset + limit],
        "total": len(rows),
        "offset": offset,
        "limit": limit,
    }


class Service:
    def __init__(self, connection, user, settings, interface="rest"):
        self.c, self.user, self.settings = connection, user, settings
        self.interface, self.operation_id = interface, uid()
        self.required_access = set()
        self.requires_admin = False

    def rows(self, table, *conditions, order=None):
        q = select(table).where(*conditions)
        if order is not None:
            q = q.order_by(*order)
        return [dict(r) for r in self.c.execute(q).mappings()]

    def row(self, table, id):
        value = self.c.execute(select(table).where(table.c.id == id)).mappings().first()
        require(value is not None, 404, "not_found", "This record is unavailable.")
        return dict(value)

    def admin(self):
        require(
            self.user and self.user["is_admin"] and self.user["kind"] == "human",
            403,
            "admin_required",
            "Administrator access is required.",
        )
        self.requires_admin = True

    def grants(self, project_id, user=None):
        user = user or self.user
        if user["is_admin"] and user["enabled"]:
            return {r: {a: True for a in m.ACTIONS} for r in m.RESOURCES}
        result = {r: {a: False for a in m.ACTIONS} for r in m.RESOURCES}
        for grant in self.rows(
            m.permissions,
            m.permissions.c.project_id == project_id,
            m.permissions.c.user_id == user["id"],
        ):
            result[grant["resource"]] = {a: grant[a] for a in m.ACTIONS}
        return result

    def can(self, project_id, resource, action="view", user=None):
        g = self.grants(project_id, user)
        allowed = (
            g["project"]["view"]
            and g[resource]["view"]
            and g[resource][action]
            and (resource not in ("comment", "attachment") or g["item"]["view"])
        )
        if allowed and user is None:
            self.required_access.add((project_id, resource, action))
        return allowed

    def cache_envelope(self, value):
        return {
            "value": value,
            "access": sorted(self.required_access),
            "admin": self.requires_admin,
        }

    def cached_response(self, envelope):
        require(
            isinstance(envelope, dict) and "access" in envelope and "value" in envelope,
            409,
            "cache_changed",
            "Use a new idempotency key for this request.",
        )
        if envelope.get("admin"):
            self.admin()
        for project_id, resource, action in envelope["access"]:
            self.access(project_id, resource, action)
        return envelope["value"]

    def access(self, project_id, resource="project", action="view"):
        self.row(m.projects, project_id)
        require(self.can(project_id, resource), 404, "not_found", "This record is unavailable.")
        require(
            self.can(project_id, resource, action),
            403,
            "forbidden",
            "You do not have permission for this action.",
        )

    def item(self, item_id, action="view"):
        item = self.row(m.items, item_id)
        self.access(item["project_id"], "item", action)
        return item

    def sprint(self, sprint_id, action="view"):
        sprint = self.row(m.sprints, sprint_id)
        self.access(sprint["project_id"], "sprint", action)
        return sprint

    def touch(self, table, row, changes=None):
        changes = dict(changes or {})
        require(
            not any(value is None and not table.c[key].nullable for key, value in changes.items()),
            422,
            "null_not_allowed",
            "This field cannot be cleared.",
        )
        changes["version"] = row["version"] + 1
        if "updated_at" in table.c:
            changes["updated_at"] = now()
        self.c.execute(update(table).where(table.c.id == row["id"]).values(**changes))
        return {**row, **changes}

    def record(
        self,
        project_id,
        item_id,
        action,
        entity_id,
        changes=None,
        resource="item",
        system=False,
        cause=None,
    ):
        actor = self.user
        changes = dict(changes or {})
        if system:
            changes["initiated_by"] = {
                "id": actor["id"],
                "name": actor["username"],
                "kind": actor["kind"],
            }
        self.c.execute(
            insert(m.activity).values(
                id=uid(),
                project_id=project_id,
                item_id=item_id,
                actor_id=None if system else actor["id"],
                actor_name="System" if system else actor["username"],
                actor_kind="system" if system else actor["kind"],
                interface="system" if system else self.interface,
                resource=resource,
                action=action,
                entity_id=entity_id,
                changes=changes or {},
                operation_id=self.operation_id,
                cause=cause,
                initiated_by=actor["id"],
                created_at=now(),
            )
        )

    def history(self, project_id, item_id=None, offset=0, limit=50, before=None):
        self.access(project_id)
        conditions = [m.activity.c.project_id == project_id]
        if item_id:
            conditions.append(m.activity.c.item_id == item_id)
        rows = self.rows(
            m.activity, *conditions, order=[m.activity.c.created_at.desc(), m.activity.c.id.desc()]
        )
        allowed = [r for r in rows if self.can(project_id, r["resource"], "view")]
        if before:
            try:
                cursor = json.loads(base64.urlsafe_b64decode(before.encode()).decode())
                require(
                    isinstance(cursor, list)
                    and len(cursor) == 2
                    and all(isinstance(v, str) for v in cursor),
                    422,
                    "invalid_cursor",
                    "Use a valid history cursor.",
                )
            except (ValueError, UnicodeError):
                raise DomainError(422, "invalid_cursor", "Use a valid history cursor.") from None
            allowed = [r for r in allowed if (r["created_at"], r["id"]) < tuple(cursor)]
        result = page(allowed, offset, limit)
        last = result["items"][-1] if result["items"] else None
        result["next_cursor"] = (
            base64.urlsafe_b64encode(json.dumps([last["created_at"], last["id"]]).encode()).decode()
            if last and result["offset"] + len(result["items"]) < result["total"]
            else None
        )
        return result

    # Account and project administration
    def create_user(self, data, initial=False):
        if not initial:
            self.admin()
        kind = data.get("kind", "human")
        secret = None
        if kind == "agent":
            require(
                not data.get("is_admin") and not data.get("username") and not data.get("password"),
                422,
                "generated_identity",
                "Agent names and passwords are generated.",
            )
            while True:
                username = f"agent-{secrets.choice(['calm', 'bright', 'quick', 'quiet'])}-{secrets.choice(['otter', 'fox', 'owl', 'lynx'])}-{secrets.token_hex(3)}"
                if not self.rows(m.users, m.users.c.username == username):
                    break
            secret, password = str(uuid4()), None
            password = secret
        else:
            username = (data.get("username") or "").strip().casefold()
            require(
                re.fullmatch(r"[a-z0-9][a-z0-9_.-]{2,63}", username),
                422,
                "invalid_username",
                "Use 3–64 letters, numbers, dots, dashes or underscores.",
            )
            password = data.get("password") or ""
            require(
                12 <= len(password) <= 256,
                422,
                "invalid_password",
                "Use a password with 12–256 characters.",
            )
        require(
            not self.rows(m.users, m.users.c.username == username),
            409,
            "username_exists",
            "That username is already in use.",
        )
        user = dict(
            id=uid(),
            username=username,
            display_name=data.get("display_name") or username,
            kind=kind,
            is_admin=bool(data.get("is_admin", False)) if kind == "human" else False,
            enabled=True,
            password_hash=passwords.hash(password),
            created_at=now(),
            updated_at=now(),
            version=1,
        )
        self.c.execute(insert(m.users).values(**user))
        self.c.execute(
            insert(m.preferences).values(
                user_id=user["id"], appearance="system", accent="Blue", version=1
            )
        )
        result = public_user(user)
        if secret:
            result["generated_password"] = secret
        return result

    def update_user(self, user_id, data, expected):
        self.admin()
        user = self.row(m.users, user_id)
        check_version(user, expected)
        require(
            user["kind"] == "human" or not data.get("is_admin"),
            422,
            "agent_admin",
            "An agent cannot be an administrator.",
        )
        if user["is_admin"] and (data.get("enabled") is False or data.get("is_admin") is False):
            count = self.c.scalar(
                select(func.count())
                .select_from(m.users)
                .where(m.users.c.is_admin.is_(True), m.users.c.enabled.is_(True))
            )
            require(count > 1, 409, "last_admin", "Keep at least one enabled human administrator.")
        changed = self.touch(m.users, user, data)
        if data.get("enabled") is False:
            self.c.execute(delete(m.sessions).where(m.sessions.c.user_id == user_id))
        return public_user(changed)

    def change_password(self, user_id, password, expected, rotate=False, current=None):
        user = self.row(m.users, user_id)
        if current is None:
            self.admin()
        else:
            require(
                user_id == self.user["id"] and verify_password(user, current),
                403,
                "incorrect_password",
                "The current password is incorrect.",
            )
        check_version(user, expected)
        require(
            (user["kind"] == "agent") == rotate,
            422,
            "wrong_user_kind",
            "Use password rotation for agents and password change for humans.",
        )
        if rotate:
            password = str(uuid4())
        require(
            password and 12 <= len(password) <= 256,
            422,
            "invalid_password",
            "Use a password with 12–256 characters.",
        )
        user = self.touch(m.users, user, {"password_hash": passwords.hash(password)})
        self.c.execute(delete(m.sessions).where(m.sessions.c.user_id == user_id))
        return {**public_user(user), **({"generated_password": password} if rotate else {})}

    def project_out(self, project):
        return {**project, "permissions": self.grants(project["id"])}

    def create_project(self, data):
        self.admin()
        key = data["key"].strip().upper()
        require(
            re.fullmatch(r"[A-Z][A-Z0-9]{1,11}", key),
            422,
            "invalid_project_key",
            "Use 2–12 uppercase letters or numbers, beginning with a letter.",
        )
        require(
            not self.rows(m.projects, m.projects.c.key == key),
            409,
            "project_key_exists",
            "That project key is already in use.",
        )
        project = dict(
            id=uid(),
            key=key,
            name=data["name"],
            description=data.get("description", ""),
            creator_id=self.user["id"],
            next_item_number=1,
            grant_revision=1,
            version=1,
            created_at=now(),
            updated_at=now(),
        )
        self.c.execute(insert(m.projects).values(**project))
        for resource in m.RESOURCES:
            self.c.execute(
                insert(m.permissions).values(
                    project_id=project["id"],
                    user_id=self.user["id"],
                    resource=resource,
                    **{
                        a: not (resource == "project" and a in ("create", "delete"))
                        for a in m.ACTIONS
                    },
                )
            )
        self.record(
            project["id"],
            None,
            "project_created",
            project["id"],
            {"name": project["name"]},
            resource="project",
        )
        return self.project_out(project)

    def list_projects(self, offset=0, limit=50):
        return page(
            [
                self.project_out(p)
                for p in self.rows(m.projects, order=[m.projects.c.name, m.projects.c.id])
                if self.can(p["id"], "project")
            ],
            offset,
            limit,
        )

    def update_project(self, project_id, data, expected):
        self.access(project_id, "project", "update")
        p = self.row(m.projects, project_id)
        check_version(p, expected)
        self.record(
            project_id,
            None,
            "project_updated",
            project_id,
            {k: {"from": p[k], "to": v} for k, v in data.items() if p[k] != v},
            resource="project",
        )
        return self.project_out(self.touch(m.projects, p, data))

    def delete_project(self, project_id, expected):
        self.admin()
        p = self.row(m.projects, project_id)
        check_version(p, expected)
        require(
            not self.rows(m.items, m.items.c.project_id == project_id)
            and not self.rows(m.sprints, m.sprints.c.project_id == project_id),
            409,
            "project_not_empty",
            "Remove all items and sprints before deleting this project.",
        )
        self.record(
            project_id,
            None,
            "project_deleted",
            project_id,
            {"key": p["key"], "name": p["name"]},
            resource="project",
        )
        self.c.execute(delete(m.projects).where(m.projects.c.id == project_id))

    def set_permissions(self, project_id, user_id, grants, expected, revoke=False):
        self.admin()
        p = self.row(m.projects, project_id)
        self.row(m.users, user_id)
        require(expected is not None, 428, "precondition_required", "Provide the grant revision.")
        require(
            p["grant_revision"] == expected,
            409,
            "grant_conflict",
            "Permissions changed. Reload before saving.",
        )
        if not revoke:
            for resource in m.RESOURCES:
                g = grants.get(resource, {})
                require(
                    not any(g.get(a) for a in m.ACTIONS if a != "view") or g.get("view"),
                    422,
                    "view_required",
                    "Write permission requires View.",
                )
                if resource == "project":
                    require(
                        not g.get("create") and not g.get("delete"),
                        422,
                        "admin_operation",
                        "Only administrators create or delete projects.",
                    )
            require(
                not any(any(g.values()) for r, g in grants.items() if r != "project")
                or grants.get("project", {}).get("view"),
                422,
                "project_view_required",
                "Project View is required.",
            )
            for resource in ("comment", "attachment"):
                require(
                    not any(grants.get(resource, {}).values())
                    or grants.get("item", {}).get("view"),
                    422,
                    "item_view_required",
                    "Comment/file access requires item View.",
                )
        self.c.execute(
            delete(m.permissions).where(
                m.permissions.c.project_id == project_id, m.permissions.c.user_id == user_id
            )
        )
        if not revoke:
            for resource in m.RESOURCES:
                self.c.execute(
                    insert(m.permissions).values(
                        project_id=project_id,
                        user_id=user_id,
                        resource=resource,
                        **{a: bool(grants.get(resource, {}).get(a)) for a in m.ACTIONS},
                    )
                )
        self.c.execute(
            update(m.projects)
            .where(m.projects.c.id == project_id)
            .values(grant_revision=expected + 1)
        )
        return {
            "grant_revision": expected + 1,
            "permissions": self.grants(project_id, self.row(m.users, user_id)),
        }

    def assignees(self, project_id):
        self.access(project_id, "item")
        return [
            {k: u[k] for k in ("id", "username", "display_name", "kind")}
            for u in self.rows(m.users, m.users.c.enabled.is_(True))
            if self.can(project_id, "item", user=u)
        ]


def verify_password(user, password):
    try:
        return passwords.verify(user["password_hash"], password)
    except (VerificationError, ValueError):
        return False


def authenticate(connection, token):
    if not token:
        raise DomainError(401, "authentication_required", "Sign in to continue.")
    row = (
        connection.execute(
            select(m.users, m.sessions.c.kind.label("session_kind"))
            .join(m.sessions, m.users.c.id == m.sessions.c.user_id)
            .where(
                m.sessions.c.token_hash == digest(token),
                m.sessions.c.expires_at > time.time(),
                m.users.c.enabled.is_(True),
            )
        )
        .mappings()
        .first()
    )
    require(row is not None, 401, "session_expired", "Your session has expired. Sign in again.")
    return dict(row)


def issue_session(connection, user_id, kind, hours):
    token = secrets.token_urlsafe(40)
    expires = time.time() + hours * 3600
    connection.execute(
        insert(m.sessions).values(
            id=uid(),
            user_id=user_id,
            token_hash=digest(token),
            kind=kind,
            created_at=now(),
            expires_at=expires,
        )
    )
    return token, expires
