from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Title = Annotated[str, Field(min_length=1, max_length=300)]
State = Literal["open", "open_question", "in_progress", "blocked", "done", "cancelled"]
ItemType = Literal["story", "task", "bug"]
Priority = Literal["none", "low", "medium", "high", "urgent"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="after")
    @classmethod
    def reject_blank(cls, value, info):
        if info.field_name in ("name", "title", "body", "display_name") and isinstance(value, str):
            if not value.strip():
                raise ValueError("Enter a nonempty value.")
        return value


class Credentials(Input):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class UserCreate(Input):
    kind: Literal["human", "agent"] = "human"
    username: str | None = None
    display_name: Title | None = None
    password: str | None = Field(default=None, max_length=256)
    is_admin: bool = False


class UserPatch(Input):
    display_name: Title | None = None
    is_admin: bool | None = None
    enabled: bool | None = None


class PasswordChange(Input):
    current_password: str
    new_password: str = Field(min_length=12, max_length=256)


class PasswordReset(Input):
    password: str = Field(min_length=12, max_length=256)


class PreferencesPatch(Input):
    appearance: Literal["light", "dark", "system"] | None = None
    accent: (
        Literal[
            "Blue", "Indigo", "Purple", "Pink", "Red", "Orange", "Amber", "Green", "Teal", "Slate"
        ]
        | None
    ) = None


class ProjectCreate(Input):
    key: str = Field(min_length=2, max_length=12)
    name: Title
    description: str = Field(default="", max_length=100000)


class ProjectPatch(Input):
    name: Title | None = None
    description: str | None = Field(default=None, max_length=100000)


class Name(Input):
    name: Title


class SprintCreate(Input):
    name: Title
    description: str = Field(default="", max_length=100000)


class SprintPatch(Input):
    name: Title | None = None
    description: str | None = Field(default=None, max_length=100000)


class Grant(Input):
    view: bool = False
    create: bool = False
    update: bool = False
    delete: bool = False


class Grants(Input):
    project: Grant = Field(default_factory=Grant)
    sprint: Grant = Field(default_factory=Grant)
    item: Grant = Field(default_factory=Grant)
    comment: Grant = Field(default_factory=Grant)
    attachment: Grant = Field(default_factory=Grant)


class PermissionCommand(Input):
    expected_revision: int
    grants: Grants


class VersionCommand(Input):
    expected_version: int


class CloseCommand(VersionCommand):
    move_unfinished_to_sprint_id: str | None = None
    destination_version: int | None = None


class ItemCreate(Input):
    title: Title
    type: ItemType
    description: str = Field(default="", max_length=100000)
    state: State = "open"
    priority: Priority = "none"
    assignee_id: str | None = None
    sprint_id: str | None = None
    label_ids: list[str] = Field(default_factory=list, max_length=200)
    blocked_by_item_ids: list[str] = Field(default_factory=list, max_length=200)


class ItemPatch(Input):
    title: Title | None = None
    type: ItemType | None = None
    description: str | None = Field(default=None, max_length=100000)
    state: State | None = None
    priority: Priority | None = None
    assignee_id: str | None = None
    sprint_id: str | None = None
    label_ids: list[str] | None = Field(default=None, max_length=200)
    blocked_by_item_ids: list[str] | None = Field(default=None, max_length=200)


class MoveCommand(Input):
    item_versions: dict[str, int] = Field(min_length=1, max_length=1000)
    sprint_id: str | None = None


class OrderCommand(Input):
    ordered_ids: list[str] = Field(max_length=10000)
    versions: dict[str, int]
    sprint_id: str | None = None


class LinkCreate(Input):
    relationship: Literal["parent", "child", "related", "blocked_by", "blocks"]
    target_item_id: str
    expected_target_version: int


class CancelCommand(VersionCommand):
    impact_revision: str
    confirm_blocker_removal: bool = False


class ResumeCommand(VersionCommand):
    blocker_revision: str


class CommentBody(Input):
    body: str = Field(min_length=1, max_length=100000)


class ItemQuery(Input):
    project_id: list[str] = Field(default_factory=list)
    sprint_id: list[str] = Field(default_factory=list)
    type: list[ItemType] = Field(default_factory=list)
    state: list[State] = Field(default_factory=list)
    assignee_id: list[str] = Field(default_factory=list)
    label_id: list[str] = Field(default_factory=list)
    priority: list[Priority] = Field(default_factory=list)
    backlog: bool = False
    unassigned: bool = False
    q: str | None = Field(default=None, max_length=500)
    updated_since: str | None = None
    blocked_by_item_id: str | None = None
    blocks_item_id: str | None = None
    ready_to_resume: bool = False
    sort: Literal["key", "title", "priority", "state", "created_at", "updated_at", "rank"] = (
        "updated_at"
    )
    direction: Literal["asc", "desc"] = "desc"
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=200)


class Output(BaseModel):
    model_config = ConfigDict(extra="allow")


class UserOut(Output):
    id: str
    username: str
    display_name: str
    kind: Literal["human", "agent"]
    is_admin: bool
    enabled: bool
    version: int
    generated_password: str | None = None


class ProjectOut(Output):
    id: str
    key: str
    name: str
    description: str
    version: int
    grant_revision: int
    permissions: dict[str, dict[str, bool]]


class LabelOut(Output):
    id: str
    name: str
    project_id: str
    version: int


class BlockerSummary(Output):
    total: int
    done: int
    remaining: int
    ready_to_resume: bool
    blocker_revision: str


class ItemOut(Output):
    id: str
    project_id: str
    key: str
    title: str
    description: str
    type: ItemType
    state: State
    priority: Priority
    sprint_id: str | None
    sprint_name: str
    sprint_title: str
    sprint_state: str | None
    assignee_id: str | None
    assignee: UserOut | None
    labels: list[LabelOut]
    label_ids: list[str]
    blocker_summary: BlockerSummary
    permissions: dict[str, dict[str, bool]]
    version: int
    created_at: str
    updated_at: str


class SprintOut(Output):
    id: str
    project_id: str
    name: str
    number: int
    title: str
    description: str
    state: Literal["planned", "active", "closed"]
    position: int
    started_at: str | None
    closed_at: str | None
    version: int
    counts: dict[str, int] | None = None
    total: int | None = None


class ItemPage(Output):
    items: list[ItemOut]
    total: int
    offset: int
    limit: int


class HierarchyItem(ItemOut):
    parent_id: str | None
    depth: int
    has_children: bool
    matches_filters: bool


class HierarchyPage(ItemPage):
    items: list[HierarchyItem]
