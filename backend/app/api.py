import hashlib
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, File, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from sqlalchemy import delete, insert, select, update

from . import models as m
from . import schemas as s
from .content import PlannerService, inspect_file
from .db import transaction
from .errors import require
from .service import (
    authenticate,
    check_version,
    digest,
    fingerprint,
    issue_session,
    now,
    page,
    public_user,
    uid,
    verify_password,
)
from .storage import reconcile

router = APIRouter(prefix="/api/v1")


def expected(request):
    header = request.headers.get("if-match", "").strip('"')
    require(
        header.isdigit(), 428, "precondition_required", "Supply the current version in If-Match."
    )
    return int(header)


def data(body):
    values = body.model_dump(exclude_unset=True)
    nullable = {"assignee_id", "sprint_id"}
    require(
        not any(v is None and k not in nullable for k, v in values.items()),
        422,
        "null_not_allowed",
        "Only optional assignee and sprint can be cleared with null.",
    )
    return values


def token(request):
    header = request.headers.get("authorization", "")
    return header[7:] if header.lower().startswith("bearer ") else request.cookies.get("lp_session")


def csrf(request):
    cookie, header = request.cookies.get("lp_csrf"), request.headers.get("x-csrf-token")
    require(
        cookie and header and secrets.compare_digest(cookie, header),
        403,
        "csrf_required",
        "Reload the page and try again.",
    )


def response(value, status=200):
    if status == 204:
        return Response(status_code=204)
    result = JSONResponse(value, status_code=status, headers={"Cache-Control": "no-store"})
    if isinstance(value, dict) and "version" in value:
        result.headers["ETag"] = f'"{value["version"]}"'
    return result


def run(request, action, write=False, payload=None, status=200, idempotent=True):
    state = request.app.state
    with transaction(state.engine, write) as c:
        user = authenticate(c, token(request))
        if write and not request.headers.get("authorization", "").lower().startswith("bearer "):
            csrf(request)
        service = PlannerService(c, user, state.settings)
        key = request.headers.get("idempotency-key") if write and idempotent else None
        request_hash = fingerprint(
            [
                request.method,
                request.url.path,
                str(request.query_params),
                request.headers.get("if-match"),
                payload,
            ]
        )
        if key:
            require(
                len(key) <= 200,
                422,
                "invalid_idempotency_key",
                "Use an idempotency key of at most 200 characters.",
            )
            cached = (
                c.execute(
                    select(m.idempotency).where(
                        m.idempotency.c.user_id == user["id"], m.idempotency.c.key == key
                    )
                )
                .mappings()
                .first()
            )
            if cached and cached["expires_at"] > time.time():
                require(
                    cached["request_hash"] == request_hash,
                    409,
                    "idempotency_conflict",
                    "This key was used for a different request.",
                )
                return response(service.cached_response(cached["response"]), status)
            if cached:
                c.execute(
                    delete(m.idempotency).where(
                        m.idempotency.c.user_id == user["id"], m.idempotency.c.key == key
                    )
                )
        value = action(service)
        if key:
            c.execute(
                insert(m.idempotency).values(
                    user_id=user["id"],
                    key=key,
                    request_hash=request_hash,
                    response=service.cache_envelope(value),
                    expires_at=time.time() + 86400,
                )
            )
    return response(value, status)


def session_response(request, user, session_token, expires):
    result = response({"user": public_user(user), "expires_at": expires})
    settings = request.app.state.settings
    result.set_cookie(
        "lp_session",
        session_token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="strict",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    result.set_cookie(
        "lp_csrf",
        secrets.token_urlsafe(32),
        secure=settings.secure_cookies,
        samesite="strict",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    return result


@router.get("/setup", tags=["Authentication"])
def setup_status(request: Request):
    with transaction(request.app.state.engine) as c:
        value = c.scalar(select(m.installation.c.initialized_at))
    result = response({"setup_required": value is None})
    if not request.cookies.get("lp_csrf"):
        result.set_cookie(
            "lp_csrf",
            secrets.token_urlsafe(32),
            secure=request.app.state.settings.secure_cookies,
            samesite="strict",
            path="/",
        )
    return result


@router.post("/setup", tags=["Authentication"])
def setup(request: Request, body: s.Credentials):
    csrf(request)
    state = request.app.state
    with transaction(state.engine, True) as c:
        require(
            c.scalar(select(m.installation.c.initialized_at)) is None,
            409,
            "already_initialized",
            "Setup is already complete. Sign in.",
        )
        user = PlannerService(c, None, state.settings).create_user(
            {**body.model_dump(), "kind": "human", "is_admin": True}, initial=True
        )
        c.execute(update(m.installation).values(initialized_at=now()))
        raw, expires = issue_session(c, user["id"], "browser", state.settings.session_hours)
    return session_response(request, user, raw, expires)


def login_user(c, credentials):
    user = (
        c.execute(
            select(m.users).where(m.users.c.username == credentials.username.strip().casefold())
        )
        .mappings()
        .first()
    )
    require(
        user and user["enabled"] and verify_password(user, credentials.password),
        401,
        "invalid_credentials",
        "The username or password is incorrect.",
    )
    return dict(user)


@router.post("/auth/login", tags=["Authentication"])
def login(request: Request, body: s.Credentials):
    csrf(request)
    state = request.app.state
    with transaction(state.engine, True) as c:
        user = login_user(c, body)
        require(
            user["kind"] == "human", 403, "human_login_required", "Agent accounts use API tokens."
        )
        raw, expires = issue_session(c, user["id"], "browser", state.settings.session_hours)
    return session_response(request, user, raw, expires)


@router.post("/auth/token", tags=["Authentication"])
def create_token(request: Request, body: s.Credentials):
    with transaction(request.app.state.engine, True) as c:
        user = login_user(c, body)
        raw, expires = issue_session(c, user["id"], "api", request.app.state.settings.token_hours)
    return response({"access_token": raw, "token_type": "Bearer", "expires_at": expires})


@router.post("/auth/logout", status_code=204, tags=["Authentication"])
@router.delete("/auth/token", status_code=204, tags=["Authentication"])
def logout(request: Request):
    def action(service):
        service.c.execute(
            delete(m.sessions).where(m.sessions.c.token_hash == digest(token(request)))
        )

    result = run(request, action, True, status=204, idempotent=False)
    result.delete_cookie("lp_session", path="/")
    return result


@router.get("/auth/me", response_model=s.UserOut, tags=["Authentication"])
def me(request: Request):
    return run(request, lambda service: public_user(service.user))


@router.put("/auth/password", tags=["Authentication"])
def own_password(request: Request, body: s.PasswordChange):
    return run(
        request,
        lambda service: service.change_password(
            service.user["id"], body.new_password, expected(request), current=body.current_password
        ),
        True,
        idempotent=False,
    )


@router.get("/me/preferences", tags=["Preferences"])
def preferences(request: Request):
    return run(
        request,
        lambda service: dict(
            service.c.execute(
                select(m.preferences).where(m.preferences.c.user_id == service.user["id"])
            )
            .mappings()
            .one()
        ),
    )


@router.patch("/me/preferences", tags=["Preferences"])
def update_preferences(request: Request, body: s.PreferencesPatch):
    def action(service):
        row = dict(
            service.c.execute(
                select(m.preferences).where(m.preferences.c.user_id == service.user["id"])
            )
            .mappings()
            .one()
        )
        check_version(row, expected(request))
        values = {**data(body), "version": row["version"] + 1}
        service.c.execute(
            update(m.preferences)
            .where(m.preferences.c.user_id == service.user["id"])
            .values(**values)
        )
        return {**row, **values}

    return run(request, action, True, body.model_dump(exclude_unset=True))


@router.get("/metadata", tags=["Preferences"])
def metadata(request: Request):
    return run(
        request,
        lambda _: {
            "item_types": m.TYPES,
            "item_states": m.STATES,
            "priorities": m.PRIORITIES,
            "link_relationships": ["parent", "child", "related", "blocked_by", "blocks"],
            "appearance_modes": ["light", "dark", "system"],
            "accents": m.ACCENTS,
            "max_file_bytes": request.app.state.settings.max_file_bytes,
            "text_preview_bytes": request.app.state.settings.text_preview_bytes,
        },
    )


@router.get("/users", tags=["Users"])
def users(
    request: Request,
    kind: str | None = None,
    enabled: bool | None = None,
    offset: int = 0,
    limit: int = 50,
):
    def action(service):
        service.admin()
        return page(
            [
                public_user(u)
                for u in service.rows(m.users, order=[m.users.c.username])
                if (kind is None or u["kind"] == kind)
                and (enabled is None or u["enabled"] == enabled)
            ],
            offset,
            limit,
        )

    return run(request, action)


@router.post("/users", response_model=s.UserOut, status_code=201, tags=["Users"])
def create_user(request: Request, body: s.UserCreate):
    return run(
        request,
        lambda service: service.create_user(body.model_dump(exclude_none=True)),
        True,
        status=201,
        idempotent=False,
    )


@router.get("/users/{user_id}", response_model=s.UserOut, tags=["Users"])
def user(request: Request, user_id: str):
    def action(service):
        service.admin()
        return public_user(service.row(m.users, user_id))

    return run(request, action)


@router.patch("/users/{user_id}", response_model=s.UserOut, tags=["Users"])
def update_user(request: Request, user_id: str, body: s.UserPatch):
    return run(
        request,
        lambda service: service.update_user(user_id, data(body), expected(request)),
        True,
        body.model_dump(exclude_unset=True),
        idempotent=False,
    )


@router.post("/users/{user_id}/reset-password", tags=["Users"])
def reset_password(request: Request, user_id: str, body: s.PasswordReset):
    return run(
        request,
        lambda service: service.change_password(user_id, body.password, expected(request)),
        True,
        idempotent=False,
    )


@router.post("/users/{user_id}/rotate-agent-password", tags=["Users"])
def rotate_password(request: Request, user_id: str):
    return run(
        request,
        lambda service: service.change_password(user_id, None, expected(request), rotate=True),
        True,
        idempotent=False,
    )


@router.get("/projects", tags=["Projects"])
def projects(request: Request, offset: int = 0, limit: int = 50):
    return run(request, lambda service: service.list_projects(offset, limit))


@router.post("/projects", response_model=s.ProjectOut, status_code=201, tags=["Projects"])
def create_project(request: Request, body: s.ProjectCreate):
    return run(
        request,
        lambda service: service.create_project(body.model_dump()),
        True,
        body.model_dump(),
        201,
    )


@router.get("/projects/{project_id}", response_model=s.ProjectOut, tags=["Projects"])
def project(request: Request, project_id: str):
    def action(service):
        service.access(project_id)
        return service.project_out(service.row(m.projects, project_id))

    return run(request, action)


@router.patch("/projects/{project_id}", response_model=s.ProjectOut, tags=["Projects"])
def update_project(request: Request, project_id: str, body: s.ProjectPatch):
    return run(
        request,
        lambda service: service.update_project(project_id, data(body), expected(request)),
        True,
        body.model_dump(exclude_unset=True),
    )


@router.delete("/projects/{project_id}", status_code=204, tags=["Projects"])
def delete_project(request: Request, project_id: str):
    return run(
        request,
        lambda service: service.delete_project(project_id, expected(request)),
        True,
        status=204,
    )


@router.get("/projects/{project_id}/permissions", tags=["Permissions"])
def project_permissions(request: Request, project_id: str):
    def action(service):
        service.admin()
        project = service.row(m.projects, project_id)
        return {
            "grant_revision": project["grant_revision"],
            "users": [
                {
                    "user": public_user(u),
                    "permissions": service.grants(project_id, u),
                    "explicit": {
                        r["resource"]: {a: r[a] for a in m.ACTIONS}
                        for r in service.rows(
                            m.permissions,
                            m.permissions.c.project_id == project_id,
                            m.permissions.c.user_id == u["id"],
                        )
                    },
                }
                for u in service.rows(m.users)
            ],
        }

    return run(request, action)


@router.put("/projects/{project_id}/permissions/{user_id}", tags=["Permissions"])
def set_permissions(request: Request, project_id: str, user_id: str, body: s.PermissionCommand):
    return run(
        request,
        lambda service: service.set_permissions(
            project_id, user_id, body.grants.model_dump(), body.expected_revision
        ),
        True,
        body.model_dump(),
    )


@router.delete(
    "/projects/{project_id}/permissions/{user_id}", status_code=204, tags=["Permissions"]
)
def revoke_permissions(request: Request, project_id: str, user_id: str, expected_revision: int):
    return run(
        request,
        lambda service: service.set_permissions(project_id, user_id, {}, expected_revision, True),
        True,
        status=204,
    )


@router.get("/projects/{project_id}/assignees", tags=["Projects"])
def assignees(request: Request, project_id: str):
    return run(request, lambda service: service.assignees(project_id))


@router.get("/home", tags=["Views"])
def home(request: Request):
    return run(request, lambda service: service.home())


@router.get("/projects/{project_id}/activity", tags=["Activity"])
def project_activity(
    request: Request,
    project_id: str,
    item_id: str | None = None,
    offset: int = 0,
    limit: int = 50,
    before: str | None = None,
):
    return run(request, lambda service: service.history(project_id, item_id, offset, limit, before))


@router.get("/projects/{project_id}/sprints", tags=["Sprints"])
def sprints(
    request: Request, project_id: str, state: str | None = None, offset: int = 0, limit: int = 50
):
    return run(request, lambda service: service.list_sprints(project_id, state, offset, limit))


@router.post(
    "/projects/{project_id}/sprints", response_model=s.SprintOut, status_code=201, tags=["Sprints"]
)
def create_sprint(request: Request, project_id: str, body: s.Name):
    return run(
        request,
        lambda service: service.create_sprint(project_id, body.name),
        True,
        body.model_dump(),
        201,
    )


@router.put("/projects/{project_id}/sprint-order", tags=["Sprints"])
def sprint_order(request: Request, project_id: str, body: s.OrderCommand):
    return run(
        request,
        lambda service: service.reorder(project_id, "sprint", body.versions, body.ordered_ids),
        True,
        body.model_dump(),
    )


@router.get("/projects/{project_id}/planning", tags=["Views"])
def planning(request: Request, project_id: str, offset: int = 0, limit: int = 50):
    return run(request, lambda service: service.planning(project_id, offset, limit))


@router.get("/sprints/{sprint_id}", response_model=s.SprintOut, tags=["Sprints"])
def sprint(request: Request, sprint_id: str):
    return run(request, lambda service: service.sprint_out(service.sprint(sprint_id)))


@router.patch("/sprints/{sprint_id}", response_model=s.SprintOut, tags=["Sprints"])
def rename_sprint(request: Request, sprint_id: str, body: s.Name):
    return run(
        request,
        lambda service: service.update_sprint(sprint_id, body.name, expected(request)),
        True,
        body.model_dump(),
    )


@router.delete("/sprints/{sprint_id}", status_code=204, tags=["Sprints"])
def delete_sprint(request: Request, sprint_id: str):
    return run(
        request,
        lambda service: service.delete_sprint(sprint_id, expected(request)),
        True,
        status=204,
    )


@router.post("/sprints/{sprint_id}/start", response_model=s.SprintOut, tags=["Sprints"])
def start_sprint(request: Request, sprint_id: str, body: s.VersionCommand):
    return run(
        request,
        lambda service: service.start_sprint(sprint_id, body.expected_version),
        True,
        body.model_dump(),
    )


@router.get("/sprints/{sprint_id}/close-preview", tags=["Sprints"])
def close_preview(request: Request, sprint_id: str):
    return run(request, lambda service: service.close_preview(sprint_id))


@router.post("/sprints/{sprint_id}/close", response_model=s.SprintOut, tags=["Sprints"])
def close_sprint(request: Request, sprint_id: str, body: s.CloseCommand):
    return run(
        request,
        lambda service: service.close_sprint(
            sprint_id,
            body.expected_version,
            body.move_unfinished_to_sprint_id,
            body.destination_version,
        ),
        True,
        body.model_dump(),
    )


@router.get("/sprints/{sprint_id}/board", tags=["Views"])
def board(
    request: Request,
    sprint_id: str,
    limit: int = 50,
    open_offset: int = 0,
    in_progress_offset: int = 0,
    blocked_offset: int = 0,
    done_offset: int = 0,
    cancelled_offset: int = 0,
):
    offsets = dict(
        zip(
            m.STATES,
            (open_offset, in_progress_offset, blocked_offset, done_offset, cancelled_offset),
        )
    )
    return run(request, lambda service: service.board(sprint_id, offsets, limit))


@router.get("/items", response_model=s.ItemPage, tags=["Items"])
def items(request: Request, query: Annotated[s.ItemQuery, Query()]):
    return run(request, lambda service: service.query_items(query.model_dump()))


@router.post(
    "/projects/{project_id}/items", response_model=s.ItemOut, status_code=201, tags=["Items"]
)
def create_item(request: Request, project_id: str, body: s.ItemCreate):
    return run(
        request,
        lambda service: service.create_item(project_id, body.model_dump()),
        True,
        body.model_dump(),
        201,
    )


@router.post("/projects/{project_id}/items/bulk-move", tags=["Items"])
def move_items(request: Request, project_id: str, body: s.MoveCommand):
    return run(
        request,
        lambda service: service.bulk_move(project_id, body.item_versions, body.sprint_id),
        True,
        body.model_dump(),
    )


@router.put("/projects/{project_id}/item-order", tags=["Items"])
def item_order(request: Request, project_id: str, body: s.OrderCommand):
    return run(
        request,
        lambda service: service.reorder(
            project_id, "item", body.versions, body.ordered_ids, body.sprint_id
        ),
        True,
        body.model_dump(),
    )


@router.get("/items/{item_id}", response_model=s.ItemOut, tags=["Items"])
def item(request: Request, item_id: str):
    return run(request, lambda service: service.item_out(service.item(item_id)))


@router.patch("/items/{item_id}", response_model=s.ItemOut, tags=["Items"])
def update_item(request: Request, item_id: str, body: s.ItemPatch):
    return run(
        request,
        lambda service: service.update_item(item_id, data(body), expected(request)),
        True,
        body.model_dump(exclude_unset=True),
    )


@router.get("/items/{item_id}/deletion-preview", tags=["Items"])
def deletion_preview(request: Request, item_id: str):
    return run(request, lambda service: service.impact(item_id, deleting=True))


@router.delete("/items/{item_id}", tags=["Items"])
def delete_item(request: Request, item_id: str, impact_revision: str):
    return run(
        request,
        lambda service: service.delete_item(item_id, expected(request), impact_revision),
        True,
    )


@router.get("/items/{item_id}/links", tags=["Links"])
def links(request: Request, item_id: str):
    return run(request, lambda service: service.item_links(item_id))


@router.post("/items/{item_id}/links", status_code=201, tags=["Links"])
def link_items(request: Request, item_id: str, body: s.LinkCreate):
    return run(
        request,
        lambda service: service.add_link(
            item_id,
            body.relationship,
            body.target_item_id,
            expected(request),
            body.expected_target_version,
        ),
        True,
        body.model_dump(),
        201,
    )


@router.delete("/items/{item_id}/links/{link_id}", tags=["Links"])
def unlink_items(request: Request, item_id: str, link_id: str, item_version: int):
    return run(
        request,
        lambda service: service.unlink(item_id, link_id, expected(request), item_version),
        True,
    )


@router.get("/items/{item_id}/cancellation-preview", tags=["Dependencies"])
def cancellation_preview(request: Request, item_id: str):
    return run(request, lambda service: service.impact(item_id))


@router.post("/items/{item_id}/cancel", tags=["Dependencies"])
def cancel_item(request: Request, item_id: str, body: s.CancelCommand):
    return run(
        request,
        lambda service: service.cancel_item(
            item_id, body.expected_version, body.impact_revision, body.confirm_blocker_removal
        ),
        True,
        body.model_dump(),
    )


@router.post("/items/{item_id}/resume", response_model=s.ItemOut, tags=["Dependencies"])
def resume_item(request: Request, item_id: str, body: s.ResumeCommand):
    return run(
        request,
        lambda service: service.resume_item(item_id, body.expected_version, body.blocker_revision),
        True,
        body.model_dump(),
    )


@router.get("/items/{item_id}/activity", tags=["Activity"])
def activity(
    request: Request, item_id: str, offset: int = 0, limit: int = 50, before: str | None = None
):
    def action(service):
        item = service.item(item_id)
        return service.history(item["project_id"], item_id, offset, limit, before)

    return run(request, action)


@router.get("/projects/{project_id}/labels", tags=["Labels"])
def labels(request: Request, project_id: str):
    return run(request, lambda service: service.list_labels(project_id))


@router.post(
    "/projects/{project_id}/labels", response_model=s.LabelOut, status_code=201, tags=["Labels"]
)
def create_label(request: Request, project_id: str, body: s.Name):
    return run(
        request,
        lambda service: service.create_label(project_id, body.name),
        True,
        body.model_dump(),
        201,
    )


@router.patch(
    "/projects/{project_id}/labels/{label_id}", response_model=s.LabelOut, tags=["Labels"]
)
def update_label(request: Request, project_id: str, label_id: str, body: s.Name):
    return run(
        request,
        lambda service: service.update_label(project_id, label_id, body.name, expected(request)),
        True,
        body.model_dump(),
    )


@router.delete("/projects/{project_id}/labels/{label_id}", status_code=204, tags=["Labels"])
def delete_label(request: Request, project_id: str, label_id: str):
    return run(
        request,
        lambda service: service.update_label(
            project_id, label_id, None, expected(request), deleting=True
        ),
        True,
        status=204,
    )


@router.get("/items/{item_id}/comments", tags=["Comments"])
def comments(request: Request, item_id: str, offset: int = 0, limit: int = 50):
    return run(request, lambda service: service.list_comments(item_id, offset, limit))


@router.post("/items/{item_id}/comments", status_code=201, tags=["Comments"])
def create_comment(request: Request, item_id: str, body: s.CommentBody):
    return run(
        request,
        lambda service: service.create_comment(item_id, body.body),
        True,
        body.model_dump(),
        201,
    )


@router.patch("/items/{item_id}/comments/{comment_id}", tags=["Comments"])
def update_comment(request: Request, item_id: str, comment_id: str, body: s.CommentBody):
    return run(
        request,
        lambda service: service.update_comment(item_id, comment_id, body.body, expected(request)),
        True,
        body.model_dump(),
    )


@router.delete("/items/{item_id}/comments/{comment_id}", status_code=204, tags=["Comments"])
def delete_comment(request: Request, item_id: str, comment_id: str):
    return run(
        request,
        lambda service: service.update_comment(
            item_id, comment_id, None, expected(request), deleting=True
        ),
        True,
        status=204,
    )


@router.get("/items/{item_id}/attachments", tags=["Attachments"])
def attachments(request: Request, item_id: str, offset: int = 0, limit: int = 50):
    return run(request, lambda service: service.list_attachments(item_id, offset, limit))


@router.post("/items/{item_id}/attachments", status_code=201, tags=["Attachments"])
async def upload_attachment(request: Request, item_id: str, file: Annotated[UploadFile, File()]):
    from starlette.concurrency import run_in_threadpool

    # Check authorization before streaming to disk, and recheck in the commit transaction.
    run(
        request,
        lambda service: service.access(service.item(item_id)["project_id"], "attachment", "create"),
    )
    directory = request.app.state.settings.data_dir / "uploads"
    directory.mkdir(parents=True, exist_ok=True)
    temp_key = uid()
    path = directory / temp_key
    size, checksum = 0, hashlib.sha256()
    try:
        with path.open("wb") as output:
            while chunk := await file.read(65536):
                size += len(chunk)
                require(
                    size <= request.app.state.settings.max_file_bytes,
                    413,
                    "file_too_large",
                    "This file exceeds the upload limit.",
                )
                checksum.update(chunk)
                await run_in_threadpool(output.write, chunk)
        mime_type, preview_kind = await run_in_threadpool(inspect_file, path)
        result = await run_in_threadpool(
            run,
            request,
            lambda service: service.add_attachment(
                item_id,
                file.filename or "attachment",
                temp_key,
                size,
                checksum.hexdigest(),
                mime_type,
                preview_kind,
            ),
            True,
            {"checksum": checksum.hexdigest(), "filename": file.filename},
            201,
        )
        await run_in_threadpool(reconcile, request.app.state.engine, request.app.state.settings)
        return result
    finally:
        await file.close()

        def cleanup_unreferenced_temp():
            with transaction(request.app.state.engine) as c:
                pending = c.scalar(
                    select(m.storage_jobs.c.id).where(m.storage_jobs.c.temp_key == temp_key)
                )
            if not pending:
                path.unlink(missing_ok=True)

        await run_in_threadpool(cleanup_unreferenced_temp)


@router.get("/attachments/{attachment_id}", tags=["Attachments"])
def attachment(request: Request, attachment_id: str):
    return run(request, lambda service: service.attachment_out(service.attachment(attachment_id)))


@router.get("/attachments/{attachment_id}/content", tags=["Attachments"])
def download(request: Request, attachment_id: str):
    state = request.app.state
    with transaction(state.engine) as c:
        service = PlannerService(c, authenticate(c, token(request)), state.settings)
        attachment = service.attachment(attachment_id)
        path = service.attachment_path(attachment)
    return FileResponse(
        path,
        filename=attachment["filename"],
        media_type="application/octet-stream",
        content_disposition_type="attachment",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"},
    )


@router.get("/attachments/{attachment_id}/preview", tags=["Attachments"])
def preview(request: Request, attachment_id: str):
    state = request.app.state
    with transaction(state.engine) as c:
        result = PlannerService(c, authenticate(c, token(request)), state.settings).preview(
            attachment_id
        )
    return (
        Response(
            result,
            media_type="image/png",
            headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"},
        )
        if isinstance(result, bytes)
        else response(result)
    )


@router.delete("/attachments/{attachment_id}", status_code=204, tags=["Attachments"])
def delete_attachment(request: Request, attachment_id: str):
    result = run(
        request,
        lambda service: service.delete_attachment(attachment_id, expected(request)),
        True,
        status=204,
    )
    reconcile(request.app.state.engine, request.app.state.settings)
    return result
