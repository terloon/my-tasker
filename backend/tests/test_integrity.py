from pathlib import Path

from app.errors import DomainError
from app.service import Service
from app.storage import reconcile
from conftest import create, item, patch


def test_idempotent_replay_rechecks_current_permissions(client, project):
    agent = create(client, "/users", {"kind": "agent"})
    bearer = client.post(
        "/api/v1/auth/token",
        json={"username": agent["username"], "password": agent["generated_password"]},
    ).json()["access_token"]
    headers = {"Authorization": "Bearer " + bearer, "Idempotency-Key": "revocable-create"}
    grant_path = f"/api/v1/projects/{project['id']}/permissions/{agent['id']}"
    client.put(
        grant_path,
        json={
            "expected_revision": 1,
            "grants": {"project": {"view": True}, "item": {"view": True, "create": True}},
        },
    )
    url, body = (
        f"/api/v1/projects/{project['id']}/items",
        {"title": "Private result", "type": "task"},
    )
    assert client.post(url, headers=headers, json=body).status_code == 201
    client.delete(grant_path + "?expected_revision=2")
    assert client.post(url, headers=headers, json=body).status_code == 404


def test_history_cursor_remains_stable_when_new_events_arrive(client, project):
    task = item(client, project)
    for n in range(6):
        assert patch(client, f"/items/{task['id']}", {"title": f"Change {n}"}).status_code == 200
    path = f"/api/v1/items/{task['id']}/activity?limit=2"
    first = client.get(path).json()
    patch(client, f"/items/{task['id']}", {"title": "New while reading"})
    seen = [e["id"] for e in first["items"]]
    cursor = first["next_cursor"]
    while cursor:
        result = client.get(path, params={"before": cursor}).json()
        seen += [e["id"] for e in result["items"]]
        cursor = result["next_cursor"]
    assert len(seen) == len(set(seen)) == 7
    assert client.get(path).json()["items"][0]["id"] not in seen


def test_history_failure_rolls_back_item_mutation(client, project, monkeypatch):
    task = item(client, project)

    def fail(*args, **kwargs):
        raise DomainError(503, "history_unavailable", "History could not be recorded.")

    monkeypatch.setattr(Service, "record", fail)
    result = patch(client, f"/items/{task['id']}", {"state": "done"})
    assert result.status_code == 503
    current = client.get(f"/api/v1/items/{task['id']}").json()
    assert current["state"] == "open" and current["version"] == task["version"]


def test_interrupted_file_finalization_retains_staged_bytes(client, project, monkeypatch):
    task = item(client, project)
    original = Path.replace

    def fail(source, target):
        if source.parent.name == "uploads":
            raise OSError("Simulated interruption")
        return original(source, target)

    with monkeypatch.context() as context:
        context.setattr(Path, "replace", fail)
        result = client.post(
            f"/api/v1/items/{task['id']}/attachments",
            files={"file": ("recover.txt", b"durable staged data", "text/plain")},
        )
        assert result.status_code == 201, result.text
        assert len(list((client.app.state.settings.data_dir / "uploads").iterdir())) == 1
    reconcile(client.app.state.engine, client.app.state.settings)
    result = client.get(f"/api/v1/items/{task['id']}/attachments").json()
    assert result["total"] == 1
    assert (
        client.get(f"/api/v1/attachments/{result['items'][0]['id']}/preview").json()["text"]
        == "durable staged data"
    )


def test_deleted_pending_upload_cannot_recreate_orphan_file(client, project, monkeypatch):
    task = item(client, project)
    original = Path.replace

    def interrupted(source, target):
        if source.parent.name == "uploads":
            raise OSError("Simulated interruption")
        return original(source, target)

    with monkeypatch.context() as context:
        context.setattr(Path, "replace", interrupted)
        uploaded = client.post(
            f"/api/v1/items/{task['id']}/attachments",
            files={"file": ("cancelled.txt", b"staged then deleted", "text/plain")},
        ).json()
        result = client.delete(
            f"/api/v1/attachments/{uploaded['id']}",
            headers={"If-Match": str(uploaded["version"])},
        )
        assert result.status_code == 204
    reconcile(client.app.state.engine, client.app.state.settings)
    assert not list((client.app.state.settings.data_dir / "attachments").iterdir())
    assert not list((client.app.state.settings.data_dir / "uploads").iterdir())
