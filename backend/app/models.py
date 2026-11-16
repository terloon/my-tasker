"""SQLite schema. Cross-project references are constrained in the database."""

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    text,
)

metadata = MetaData(
    naming_convention={
        "ix": "ix_%(table_name)s_%(column_0_name)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)
STATES = ("open", "open_question", "in_progress", "blocked", "done", "cancelled")
TYPES = ("story", "task", "bug")
PRIORITIES = ("none", "low", "medium", "high", "urgent")
RESOURCES = ("project", "sprint", "item", "comment", "attachment")
ACTIONS = ("view", "create", "update", "delete")
ACCENTS = ("Blue", "Indigo", "Purple", "Pink", "Red", "Orange", "Amber", "Green", "Teal", "Slate")


def ident():
    return Column("id", String, primary_key=True)


def version():
    return Column("version", Integer, nullable=False, default=1)


def timestamps():
    return [
        Column("created_at", String, nullable=False),
        Column("updated_at", String, nullable=False),
    ]


def choice(column, values):
    return CheckConstraint(f"{column} IN ({','.join(repr(v) for v in values)})")


installation = Table(
    "installation",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("initialized_at", String),
    CheckConstraint("id = 1"),
)
users = Table(
    "users",
    metadata,
    ident(),
    Column("username", String, nullable=False, unique=True),
    Column("display_name", String, nullable=False),
    Column("kind", String, nullable=False),
    Column("is_admin", Boolean, nullable=False, default=False),
    Column("enabled", Boolean, nullable=False, default=True),
    Column("password_hash", Text, nullable=False),
    *timestamps(),
    version(),
    choice("kind", ("human", "agent")),
    CheckConstraint("kind != 'agent' OR is_admin = 0"),
)
preferences = Table(
    "user_preferences",
    metadata,
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
    Column("appearance", String, nullable=False, default="system"),
    Column("accent", String, nullable=False, default="Blue"),
    version(),
    choice("appearance", ("light", "dark", "system")),
    choice("accent", ACCENTS),
)
sessions = Table(
    "auth_sessions",
    metadata,
    ident(),
    Column("user_id", String, ForeignKey("users.id"), nullable=False),
    Column("token_hash", String, unique=True, nullable=False),
    Column("kind", String, nullable=False),
    Column("expires_at", Float, nullable=False),
    Column("created_at", String, nullable=False),
    choice("kind", ("browser", "api")),
)
projects = Table(
    "projects",
    metadata,
    ident(),
    Column("key", String, unique=True, nullable=False),
    Column("name", String, nullable=False),
    Column("description", Text, nullable=False, default=""),
    Column("next_item_number", Integer, nullable=False, default=1),
    Column("creator_id", String, ForeignKey("users.id"), nullable=False),
    Column("grant_revision", Integer, nullable=False, default=1),
    *timestamps(),
    version(),
)
permissions = Table(
    "project_permissions",
    metadata,
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
    Column("resource", String, primary_key=True),
    *[Column(a, Boolean, nullable=False, default=False) for a in ACTIONS],
    choice("resource", RESOURCES),
    CheckConstraint('view = 1 OR ("create" = 0 AND "update" = 0 AND "delete" = 0)'),
)
sprints = Table(
    "sprints",
    metadata,
    ident(),
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
    Column("name", String, nullable=False),
    Column("description", Text, nullable=False, default="", server_default=""),
    Column("position", Integer, nullable=False),
    Column("state", String, nullable=False, default="planned"),
    Column("started_at", String),
    Column("closed_at", String),
    *timestamps(),
    version(),
    UniqueConstraint("project_id", "id"),
    choice("state", ("planned", "active", "closed")),
    CheckConstraint(
        "(state='planned' AND started_at IS NULL AND closed_at IS NULL) OR (state='active' AND started_at IS NOT NULL AND closed_at IS NULL) OR (state='closed' AND started_at IS NOT NULL AND closed_at IS NOT NULL AND closed_at >= started_at)"
    ),
)
Index(
    "one_active_sprint_per_project",
    sprints.c.project_id,
    unique=True,
    sqlite_where=text("state = 'active'"),
)
items = Table(
    "items",
    metadata,
    ident(),
    Column("project_id", String, ForeignKey("projects.id"), nullable=False),
    Column("number", Integer, nullable=False),
    Column("title", String, nullable=False),
    Column("description", Text, nullable=False, default=""),
    Column("type", String, nullable=False),
    Column("state", String, nullable=False, default="open"),
    Column("priority", String, nullable=False, default="none"),
    Column("assignee_id", String, ForeignKey("users.id")),
    Column("reporter_id", String, ForeignKey("users.id"), nullable=False),
    Column("sprint_id", String),
    Column("rank", Integer, nullable=False, default=0),
    *timestamps(),
    version(),
    UniqueConstraint("project_id", "id"),
    UniqueConstraint("project_id", "number"),
    ForeignKeyConstraint(["project_id", "sprint_id"], ["sprints.project_id", "sprints.id"]),
    choice("type", TYPES),
    choice("state", STATES),
    choice("priority", PRIORITIES),
    CheckConstraint("number > 0"),
)
for cols in (
    ("project_id", "sprint_id", "state", "rank", "id"),
    ("project_id", "type"),
    ("project_id", "assignee_id"),
    ("project_id", "priority"),
    ("updated_at",),
):
    Index("item_" + "_".join(cols), *[items.c[c] for c in cols])
labels = Table(
    "labels",
    metadata,
    ident(),
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
    Column("name", String, nullable=False),
    Column("normalized_name", String, nullable=False),
    version(),
    UniqueConstraint("project_id", "id"),
    UniqueConstraint("project_id", "normalized_name"),
)
item_labels = Table(
    "item_labels",
    metadata,
    Column("project_id", String, nullable=False),
    Column("item_id", String, primary_key=True),
    Column("label_id", String, primary_key=True),
    ForeignKeyConstraint(
        ["project_id", "item_id"], ["items.project_id", "items.id"], ondelete="CASCADE"
    ),
    ForeignKeyConstraint(
        ["project_id", "label_id"], ["labels.project_id", "labels.id"], ondelete="CASCADE"
    ),
)
links = Table(
    "item_links",
    metadata,
    ident(),
    Column("project_id", String, nullable=False),
    Column("kind", String, nullable=False),
    Column("source_id", String, nullable=False),
    Column("target_id", String, nullable=False),
    Column("creator_id", String, ForeignKey("users.id"), nullable=False),
    Column("created_at", String, nullable=False),
    version(),
    ForeignKeyConstraint(
        ["project_id", "source_id"], ["items.project_id", "items.id"], ondelete="CASCADE"
    ),
    ForeignKeyConstraint(
        ["project_id", "target_id"], ["items.project_id", "items.id"], ondelete="CASCADE"
    ),
    UniqueConstraint("kind", "source_id", "target_id"),
    choice("kind", ("parent_child", "related", "blocked_by")),
    CheckConstraint("source_id != target_id"),
)
Index(
    "one_parent_per_child",
    links.c.target_id,
    unique=True,
    sqlite_where=text("kind = 'parent_child'"),
)
Index("dependency_dependents", links.c.kind, links.c.target_id, links.c.source_id)
comments = Table(
    "comments",
    metadata,
    ident(),
    Column("project_id", String, nullable=False),
    Column("item_id", String, nullable=False),
    Column("author_id", String, ForeignKey("users.id"), nullable=False),
    Column("last_editor_id", String, ForeignKey("users.id"), nullable=False),
    Column("body", Text, nullable=False),
    *timestamps(),
    version(),
    ForeignKeyConstraint(
        ["project_id", "item_id"], ["items.project_id", "items.id"], ondelete="CASCADE"
    ),
)
attachments = Table(
    "attachments",
    metadata,
    ident(),
    Column("project_id", String, nullable=False),
    Column("item_id", String, nullable=False),
    Column("uploader_id", String, ForeignKey("users.id"), nullable=False),
    Column("filename", String, nullable=False),
    Column("storage_key", String, unique=True, nullable=False),
    Column("mime_type", String, nullable=False),
    Column("size", Integer, nullable=False),
    Column("checksum", String, nullable=False),
    Column("preview_kind", String),
    Column("storage_state", String, nullable=False),
    Column("created_at", String, nullable=False),
    version(),
    ForeignKeyConstraint(
        ["project_id", "item_id"], ["items.project_id", "items.id"], ondelete="CASCADE"
    ),
)
storage_jobs = Table(
    "storage_jobs",
    metadata,
    ident(),
    Column("attachment_id", String, ForeignKey("attachments.id", ondelete="SET NULL")),
    Column("storage_key", String, nullable=False),
    Column("temp_key", String),
    Column("operation", String, nullable=False),
    Column("attempts", Integer, nullable=False, default=0),
    Column("created_at", String, nullable=False),
)
activity = Table(
    "activity_events",
    metadata,
    ident(),
    Column("project_id", String, nullable=False),
    Column("item_id", String),
    Column("actor_id", String),
    Column("actor_name", String, nullable=False),
    Column("actor_kind", String, nullable=False),
    Column("interface", String, nullable=False),
    Column("resource", String, nullable=False),
    Column("action", String, nullable=False),
    Column("entity_id", String, nullable=False),
    Column("changes", JSON, nullable=False),
    Column("operation_id", String, nullable=False),
    Column("cause", String),
    Column("initiated_by", String),
    Column("created_at", String, nullable=False),
)
Index("item_history", activity.c.item_id, activity.c.created_at, activity.c.id)
Index("project_history", activity.c.project_id, activity.c.created_at, activity.c.id)
idempotency = Table(
    "idempotency_records",
    metadata,
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
    Column("key", String, primary_key=True),
    Column("request_hash", String, nullable=False),
    Column("response", JSON, nullable=False),
    Column("expires_at", Float, nullable=False),
)
