FROM node:24-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:0.11.1 AS uv
FROM python:3.12-slim AS dependencies
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim
RUN groupadd --gid 10001 planner && useradd --uid 10001 --gid planner --create-home planner \
    && mkdir -p /data /app/frontend/dist && chown planner:planner /data
WORKDIR /app/backend
COPY --from=dependencies /app/backend/.venv /app/backend/.venv
COPY backend/app ./app
COPY backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY --from=frontend /build/dist /app/frontend/dist
ENV PATH="/app/backend/.venv/bin:$PATH" \
    PLANNER_DATA_DIR=/data \
    PLANNER_FRONTEND_DIR=/app/frontend/dist \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER planner
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=3)"
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log"]
