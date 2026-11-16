"""The official SDK transport and typed tools over the same application services."""

import base64
import binascii
import hashlib
import json
import time
from typing import Any

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import Field, create_model
from sqlalchemy import delete, insert, select
from starlette.concurrency import run_in_threadpool

from . import models as m
from . import schemas as s
from .content import PlannerService, inspect_file
from .db import transaction
from .errors import DomainError, require
from .service import authenticate, fingerprint, public_user, uid
from .storage import reconcile


def create_mcp(engine, settings):
    hosts = settings.allowed_hosts.split(",")
    server = FastMCP(
        "Local Planner",
        instructions="Local planning tools. Read current versions before writes. Blocked needs Blocked by links. Preview cancellation/deletion impact before confirming. Never infer automatic resume from a ready indicator.",
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=True,
            allowed_hosts=hosts + [h + ":*" for h in hosts],
            allowed_origins=settings.allowed_origins.split(","),
        ),
    )

    def register(name, fields, action, write=False, destructive=False):
        model = create_model(
            name.title().replace("_", "") + "Input",
            __base__=s.Input,
            **fields,
            **({"idempotency_key": (str | None, None)} if write else {}),
        )

        async def tool(ctx: Context, arguments):
            request = ctx.request_context.request
            header = request.headers.get("authorization", "") if request else ""
            raw = header[7:] if header.lower().startswith("bearer ") else None

            def execute():
                with transaction(engine, write) as c:
                    user = authenticate(c, raw)
                    require(
                        user["session_kind"] == "api",
                        401,
                        "api_token_required",
                        "Use an API bearer token for MCP.",
                    )
                    service = PlannerService(c, user, settings, "mcp")
                    key = getattr(arguments, "idempotency_key", None)
                    hashed = fingerprint([name, arguments.model_dump(exclude={"idempotency_key"})])
                    if key:
                        old = (
                            c.execute(
                                select(m.idempotency).where(
                                    m.idempotency.c.user_id == user["id"],
                                    m.idempotency.c.key == key,
                                )
                            )
                            .mappings()
                            .first()
                        )
                        if old and old["expires_at"] > time.time():
                            require(
                                old["request_hash"] == hashed,
                                409,
                                "idempotency_conflict",
                                "That key was used for different input.",
                            )
                            return service.cached_response(old["response"])
                        if old:
                            c.execute(
                                delete(m.idempotency).where(
                                    m.idempotency.c.user_id == user["id"],
                                    m.idempotency.c.key == key,
                                )
                            )
                    result = action(service, arguments)
                    if key:
                        c.execute(
                            insert(m.idempotency).values(
                                user_id=user["id"],
                                key=key,
                                request_hash=hashed,
                                response=service.cache_envelope(result),
                                expires_at=time.time() + 86400,
                            )
                        )
                    return result

            try:
                result = await run_in_threadpool(execute)
                if name in ("attach_file", "delete_attachment", "delete_item"):
                    await run_in_threadpool(reconcile, engine, settings)
                return (
                    result
                    if isinstance(result, dict)
                    else {"items": result}
                    if isinstance(result, list)
                    else {"success": True}
                )
            except DomainError as exc:
                raise ToolError(
                    json.dumps({"code": exc.code, "message": exc.message, "details": exc.details})
                ) from None

        tool.__annotations__["arguments"] = model
        tool.__annotations__["return"] = dict[str, Any]
        server.add_tool(
            tool,
            name=name,
            description=name.replace("_", " ").capitalize()
            + ". Permissions are enforced for the authenticated user on each call.",
            annotations=ToolAnnotations(
                readOnlyHint=not write,
                destructiveHint=destructive,
                idempotentHint=not write,
                openWorldHint=False,
            ),
            structured_output=True,
        )

    ID = (str, ...)
    VER = (int, ...)
    pagination = {
        "offset": (int, Field(default=0, ge=0)),
        "limit": (int, Field(default=50, ge=1, le=200)),
    }
    register("who_am_i", {}, lambda service, a: public_user(service.user))
    register(
        "get_metadata",
        {},
        lambda service, a: {
            "item_states": m.STATES,
            "item_types": m.TYPES,
            "priorities": m.PRIORITIES,
            "link_relationships": ["parent", "child", "related", "blocked_by", "blocks"],
        },
    )
    register(
        "list_projects", pagination, lambda service, a: service.list_projects(a.offset, a.limit)
    )
    register(
        "get_project",
        {"project_id": ID},
        lambda service, a: (
            service.access(a.project_id),
            service.project_out(service.row(m.projects, a.project_id)),
        )[1],
    )
    register("get_home", {}, lambda service, a: service.home())
    register(
        "update_project",
        {"project_id": ID, "expected_version": VER, "data": (s.ProjectPatch, ...)},
        lambda service, a: service.update_project(
            a.project_id, a.data.model_dump(exclude_unset=True), a.expected_version
        ),
        True,
    )
    register(
        "list_assignees", {"project_id": ID}, lambda service, a: service.assignees(a.project_id)
    )
    register(
        "list_activity",
        {
            "project_id": ID,
            "item_id": (str | None, None),
            "before": (str | None, None),
            **pagination,
        },
        lambda service, a: service.history(a.project_id, a.item_id, a.offset, a.limit, a.before),
    )
    register(
        "list_sprints",
        {"project_id": ID, **pagination},
        lambda service, a: service.list_sprints(a.project_id, offset=a.offset, limit=a.limit),
    )
    register(
        "get_sprint",
        {"sprint_id": ID},
        lambda service, a: service.sprint_out(service.sprint(a.sprint_id)),
    )
    register(
        "get_planning",
        {"project_id": ID, **pagination},
        lambda service, a: service.planning(a.project_id, a.offset, a.limit),
    )
    register(
        "get_sprint_board",
        {
            "sprint_id": ID,
            "offsets": (dict[str, int], {}),
            "limit": (int, Field(default=50, ge=1, le=200)),
        },
        lambda service, a: service.board(a.sprint_id, a.offsets, a.limit),
    )
    register(
        "create_sprint",
        {
            "project_id": ID,
            "name": (s.Title, ...),
            "description": (str, Field(default="", max_length=100000)),
        },
        lambda service, a: service.create_sprint(a.project_id, a.name, a.description),
        True,
    )
    register(
        "update_sprint",
        {
            "sprint_id": ID,
            "expected_version": VER,
            "name": (s.Title | None, None),
            "description": (str | None, Field(default=None, max_length=100000)),
        },
        lambda service, a: service.update_sprint(
            a.sprint_id,
            {key: getattr(a, key) for key in ("name", "description") if key in a.model_fields_set},
            a.expected_version,
        ),
        True,
    )
    register(
        "reorder_sprints",
        {"project_id": ID, "data": (s.OrderCommand, ...)},
        lambda service, a: service.reorder(
            a.project_id, "sprint", a.data.versions, a.data.ordered_ids
        ),
        True,
    )
    register(
        "delete_sprint",
        {"sprint_id": ID, "expected_version": VER},
        lambda service, a: service.delete_sprint(a.sprint_id, a.expected_version),
        True,
        True,
    )
    register(
        "start_sprint",
        {"sprint_id": ID, "expected_version": VER},
        lambda service, a: service.start_sprint(a.sprint_id, a.expected_version),
        True,
    )
    register(
        "preview_sprint_close",
        {"sprint_id": ID},
        lambda service, a: service.close_preview(a.sprint_id),
    )
    register(
        "close_sprint",
        {"sprint_id": ID, "data": (s.CloseCommand, ...)},
        lambda service, a: service.close_sprint(
            a.sprint_id,
            a.data.expected_version,
            a.data.move_unfinished_to_sprint_id,
            a.data.destination_version,
        ),
        True,
    )
    register(
        "query_items",
        {"query": (s.ItemQuery, Field(default_factory=s.ItemQuery))},
        lambda service, a: service.query_items(a.query.model_dump()),
    )
    register(
        "get_item", {"item_id": ID}, lambda service, a: service.item_out(service.item(a.item_id))
    )
    register(
        "create_item",
        {"project_id": ID, "data": (s.ItemCreate, ...)},
        lambda service, a: service.create_item(a.project_id, a.data.model_dump()),
        True,
    )
    register(
        "update_item",
        {"item_id": ID, "expected_version": VER, "data": (s.ItemPatch, ...)},
        lambda service, a: service.update_item(
            a.item_id, a.data.model_dump(exclude_unset=True), a.expected_version
        ),
        True,
    )
    register(
        "preview_item_deletion", {"item_id": ID}, lambda service, a: service.impact(a.item_id, True)
    )
    register(
        "delete_item",
        {"item_id": ID, "expected_version": VER, "impact_revision": ID},
        lambda service, a: service.delete_item(a.item_id, a.expected_version, a.impact_revision),
        True,
        True,
    )
    register(
        "move_items",
        {"project_id": ID, "data": (s.MoveCommand, ...)},
        lambda service, a: service.bulk_move(a.project_id, a.data.item_versions, a.data.sprint_id),
        True,
    )
    register(
        "reorder_items",
        {"project_id": ID, "data": (s.OrderCommand, ...)},
        lambda service, a: service.reorder(
            a.project_id, "item", a.data.versions, a.data.ordered_ids, a.data.sprint_id
        ),
        True,
    )
    register(
        "preview_item_cancellation", {"item_id": ID}, lambda service, a: service.impact(a.item_id)
    )
    register(
        "cancel_item",
        {"item_id": ID, "data": (s.CancelCommand, ...)},
        lambda service, a: service.cancel_item(
            a.item_id,
            a.data.expected_version,
            a.data.impact_revision,
            a.data.confirm_blocker_removal,
        ),
        True,
        True,
    )
    register(
        "resume_item",
        {"item_id": ID, "data": (s.ResumeCommand, ...)},
        lambda service, a: service.resume_item(
            a.item_id, a.data.expected_version, a.data.blocker_revision
        ),
        True,
    )
    register("list_item_links", {"item_id": ID}, lambda service, a: service.item_links(a.item_id))
    register(
        "link_items",
        {"item_id": ID, "expected_version": VER, "data": (s.LinkCreate, ...)},
        lambda service, a: service.add_link(
            a.item_id,
            a.data.relationship,
            a.data.target_item_id,
            a.expected_version,
            a.data.expected_target_version,
        ),
        True,
    )
    register(
        "unlink_items",
        {"item_id": ID, "link_id": ID, "expected_link_version": VER, "expected_item_version": VER},
        lambda service, a: service.unlink(
            a.item_id, a.link_id, a.expected_link_version, a.expected_item_version
        ),
        True,
        True,
    )
    register(
        "list_labels", {"project_id": ID}, lambda service, a: service.list_labels(a.project_id)
    )
    register(
        "create_label",
        {"project_id": ID, "name": (s.Title, ...)},
        lambda service, a: service.create_label(a.project_id, a.name),
        True,
    )
    register(
        "update_label",
        {"project_id": ID, "label_id": ID, "name": (s.Title, ...), "expected_version": VER},
        lambda service, a: service.update_label(
            a.project_id, a.label_id, a.name, a.expected_version
        ),
        True,
    )
    register(
        "delete_label",
        {"project_id": ID, "label_id": ID, "expected_version": VER},
        lambda service, a: service.update_label(
            a.project_id, a.label_id, None, a.expected_version, True
        ),
        True,
        True,
    )
    register(
        "list_comments",
        {"item_id": ID, **pagination},
        lambda service, a: service.list_comments(a.item_id, a.offset, a.limit),
    )
    register(
        "create_comment",
        {"item_id": ID, "data": (s.CommentBody, ...)},
        lambda service, a: service.create_comment(a.item_id, a.data.body),
        True,
    )
    register(
        "update_comment",
        {"item_id": ID, "comment_id": ID, "expected_version": VER, "data": (s.CommentBody, ...)},
        lambda service, a: service.update_comment(
            a.item_id, a.comment_id, a.data.body, a.expected_version
        ),
        True,
    )
    register(
        "delete_comment",
        {"item_id": ID, "comment_id": ID, "expected_version": VER},
        lambda service, a: service.update_comment(
            a.item_id, a.comment_id, None, a.expected_version, True
        ),
        True,
        True,
    )
    register(
        "list_attachments",
        {"item_id": ID, **pagination},
        lambda service, a: service.list_attachments(a.item_id, a.offset, a.limit),
    )
    register(
        "get_attachment",
        {"attachment_id": ID},
        lambda service, a: service.attachment_out(service.attachment(a.attachment_id)),
    )
    register(
        "read_attachment_text",
        {"attachment_id": ID},
        lambda service, a: (
            service.preview(a.attachment_id)
            if service.attachment(a.attachment_id)["preview_kind"] == "text"
            else {"message": "Use the authenticated REST image preview or download endpoint."}
        ),
    )
    register(
        "delete_attachment",
        {"attachment_id": ID, "expected_version": VER},
        lambda service, a: service.delete_attachment(a.attachment_id, a.expected_version),
        True,
        True,
    )

    def attach(service, a):
        require(
            len(a.content_base64) <= 1_400_000,
            413,
            "file_too_large",
            "Use REST multipart upload for files over 1 MiB.",
        )
        try:
            content = base64.b64decode(a.content_base64, validate=True)
        except (ValueError, binascii.Error):
            raise DomainError(422, "invalid_base64", "Provide valid base64 content.") from None
        require(
            len(content) <= 1024 * 1024,
            413,
            "file_too_large",
            "Use REST multipart upload for files over 1 MiB.",
        )
        service.access(service.item(a.item_id)["project_id"], "attachment", "create")
        key = uid()
        path = settings.data_dir / "uploads" / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        mime, preview = inspect_file(path)
        return service.add_attachment(
            a.item_id,
            a.filename,
            key,
            len(content),
            hashlib.sha256(content).hexdigest(),
            mime,
            preview,
        )

    register(
        "attach_file",
        {
            "item_id": ID,
            "filename": (str, Field(max_length=200)),
            "content_base64": (str, Field(max_length=1_400_000)),
        },
        attach,
        True,
    )
    return server
