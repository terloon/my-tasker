import asyncio
import logging
import sqlite3
import tempfile
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import models as m
from .api import router, token
from .config import Settings
from .db import make_engine, migrate, transaction
from .errors import DomainError
from .mcp import create_mcp
from .service import authenticate
from .storage import reconcile

log = logging.getLogger(__name__)


def create_app(settings=None):
    settings = settings or Settings()
    engine = make_engine(settings)
    migrate(engine)
    sdk = create_mcp(engine, settings)
    mcp_app = sdk.streamable_http_app()

    async def maintenance():
        while True:
            await asyncio.sleep(30)
            try:
                await run_in_threadpool(reconcile, engine, settings)
            except Exception:
                log.exception("Attachment maintenance failed")

    @asynccontextmanager
    async def lifespan(app):
        await run_in_threadpool(reconcile, engine, settings)
        async with sdk.session_manager.run():
            task = asyncio.create_task(maintenance())
            try:
                yield
            finally:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
        engine.dispose()

    app = FastAPI(
        title="Local Planner API",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.engine, app.state.settings, app.state.mcp = engine, settings, sdk
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts.split(","))

    def error_response(request, status, code, message, details=None):
        headers = {
            "Cache-Control": "no-store",
            "X-Request-ID": getattr(request.state, "request_id", ""),
        }
        if status == 503:
            headers["Retry-After"] = "1"
        return JSONResponse(
            {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": getattr(request.state, "request_id", ""),
            },
            status_code=status,
            headers=headers,
        )

    @app.exception_handler(DomainError)
    async def domain_error(request, exc):
        return error_response(request, exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return error_response(
            request,
            422,
            "validation_error",
            "Check the submitted values.",
            {
                "errors": [
                    {"field": ".".join(map(str, e["loc"])), "message": e["msg"]}
                    for e in exc.errors()
                ]
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request, exc):
        return error_response(
            request,
            409,
            "constraint_conflict",
            "The change conflicts with another record or project rule.",
        )

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        return error_response(
            request,
            exc.status_code,
            "not_found" if exc.status_code == 404 else "http_error",
            str(exc.detail),
        )

    @app.exception_handler(OperationalError)
    async def database_error(request, exc):
        if isinstance(exc.orig, sqlite3.OperationalError) and (
            "locked" in str(exc.orig) or "busy" in str(exc.orig)
        ):
            return error_response(
                request, 503, "database_busy", "The app is busy. Try again shortly."
            )
        log.exception("Database operation failed")
        return error_response(
            request, 500, "database_error", "The operation could not be completed."
        )

    @app.middleware("http")
    async def boundary(request, call_next):
        request.state.request_id = str(uuid4())
        origin = request.headers.get("origin")
        if origin and origin not in settings.allowed_origins.split(","):
            return error_response(request, 403, "origin_denied", "This origin is not allowed.")
        if request.url.path.startswith("/api/v1/") or request.url.path == "/mcp":

            def initialized():
                with transaction(engine) as c:
                    return c.scalar(select(m.installation.c.initialized_at)) is not None

            if not await run_in_threadpool(initialized) and request.url.path != "/api/v1/setup":
                return error_response(
                    request, 409, "setup_required", "Create the initial administrator first."
                )
        if request.url.path == "/mcp":

            def check_token():
                with transaction(engine) as c:
                    raw = request.headers.get("authorization", "")
                    if not raw.lower().startswith("bearer "):
                        raise DomainError(
                            401, "api_token_required", "An API bearer token is required."
                        )
                    user = authenticate(c, raw[7:])
                    if user["session_kind"] != "api":
                        raise DomainError(401, "api_token_required", "Use an API token.")

            try:
                await run_in_threadpool(check_token)
            except DomainError as exc:
                return error_response(request, exc.status, exc.code, exc.message)
        result = await call_next(request)
        result.headers["X-Request-ID"] = request.state.request_id
        result.headers["X-Content-Type-Options"] = "nosniff"
        result.headers["Referrer-Policy"] = "same-origin"
        if result.status_code == 201 and "location" not in result.headers:
            result.headers["Location"] = request.url.path
        return result

    app.include_router(router)
    original_openapi = app.openapi
    app.state.openapi_documented = False

    def documented_openapi():
        schema = original_openapi()
        if app.state.openapi_documented:
            return schema
        schema.setdefault("components", {}).setdefault("securitySchemes", {}).update(
            {
                "ApiToken": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "Opaque token from POST /auth/token.",
                },
                "BrowserSession": {"type": "apiKey", "in": "cookie", "name": "lp_session"},
            }
        )
        schema["info"]["description"] = (
            "Local-only planning API. Browser mutations require X-CSRF-Token matching the lp_csrf cookie. Versioned edits/deletes require If-Match. Multi-record commands carry expected versions in their JSON body. Errors use code/message/details/request_id."
        )
        public = {"/api/v1/setup", "/api/v1/auth/login", "/api/v1/auth/token"}
        for path, methods in schema["paths"].items():
            for method, operation in methods.items():
                if method not in ("get", "post", "patch", "put", "delete"):
                    continue
                operation["security"] = (
                    []
                    if path in public and method != "delete"
                    else [{"ApiToken": []}, {"BrowserSession": []}]
                )
                needs_version = (
                    method == "patch"
                    or (
                        method == "delete"
                        and not path.endswith("/auth/token")
                        and "/permissions/" not in path
                    )
                    or path.endswith(
                        ("/auth/password", "/reset-password", "/rotate-agent-password")
                    )
                )
                if needs_version:
                    operation.setdefault("parameters", []).append(
                        {
                            "name": "If-Match",
                            "in": "header",
                            "required": True,
                            "schema": {"type": "string"},
                            "description": "Current record version, optionally quoted as an ETag.",
                        }
                    )
                if (
                    method in ("post", "put", "patch", "delete")
                    and path not in public
                    and "/users" not in path
                    and "/auth/" not in path
                ):
                    operation.setdefault("parameters", []).append(
                        {
                            "name": "Idempotency-Key",
                            "in": "header",
                            "required": False,
                            "schema": {"type": "string", "maxLength": 200},
                        }
                    )
        app.state.openapi_documented = True
        return schema

    app.openapi = documented_openapi

    @app.get("/health/live", include_in_schema=False)
    def live():
        return {"status": "ok"}

    @app.get("/health/ready", include_in_schema=False)
    def ready():
        try:
            with transaction(engine) as c:
                c.exec_driver_sql("SELECT 1")
            with tempfile.TemporaryFile(dir=settings.data_dir) as probe:
                probe.write(b"ready")
                probe.flush()
        except OSError:
            raise DomainError(
                503, "storage_unavailable", "The data directory is not writable."
            ) from None
        return {"status": "ok"}

    @app.get("/api/v1/openapi.json", include_in_schema=False)
    @app.get("/api/v1/docs", include_in_schema=False)
    def docs(request: Request):
        with transaction(engine) as c:
            authenticate(c, token(request))
        return (
            get_swagger_ui_html(openapi_url="/api/v1/openapi.json", title="Local Planner API")
            if request.url.path.endswith("docs")
            else JSONResponse(app.openapi())
        )

    app.add_route("/mcp", mcp_app, methods=["POST", "GET", "DELETE"])

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith(("api/", "mcp/", "health/")):
            raise DomainError(404, "not_found", "This endpoint does not exist.")
        root = settings.frontend_dir.resolve()
        requested = (root / path).resolve()
        if requested.is_relative_to(root) and requested.is_file():
            return FileResponse(requested)
        if path.startswith("assets/") or Path(path).suffix:
            raise DomainError(404, "not_found", "This file does not exist.")
        if (root / "index.html").is_file():
            return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})
        return JSONResponse(
            {"message": "Build the frontend or run the Vite development server."}, status_code=503
        )

    return app
