import pytest
from app.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    app = create_app(Settings(data_dir=tmp_path, frontend_dir=tmp_path / "frontend"))
    with TestClient(app) as client:
        client.get("/api/v1/setup")
        client.headers["X-CSRF-Token"] = client.cookies.get("lp_csrf")
        result = client.post(
            "/api/v1/setup", json={"username": "admin", "password": "test-password-twelve"}
        )
        assert result.status_code == 200, result.text
        client.headers["X-CSRF-Token"] = client.cookies.get("lp_csrf")
        yield client


def create(client, path, body):
    result = client.post("/api/v1" + path, json=body)
    assert result.status_code == 201, result.text
    return result.json()


def patch(client, path, body, version=None):
    if version is None:
        version = client.get("/api/v1" + path).json()["version"]
    return client.patch("/api/v1" + path, json=body, headers={"If-Match": str(version)})


@pytest.fixture
def project(client):
    return create(client, "/projects", {"key": "TEST", "name": "Test project"})


def item(client, project, title="Work", **fields):
    return create(
        client, f"/projects/{project['id']}/items", {"title": title, "type": "task", **fields}
    )
