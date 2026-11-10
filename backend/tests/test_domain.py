from concurrent.futures import ThreadPoolExecutor

import pytest
from app import models as m
from app.content import PlannerService
from app.db import transaction
from app.errors import DomainError
from conftest import create, item, patch
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError


def test_setup_once_csrf_and_secrets(client):
    assert (
        client.post(
            "/api/v1/setup", json={"username": "other", "password": "test-password-twelve"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/v1/projects", json={"key": "NO", "name": "No"}, headers={"x-csrf-token": "wrong"}
        ).status_code
        == 403
    )
    assert (
        client.get("/api/v1/auth/me", headers={"Origin": "https://evil.example"}).status_code == 403
    )
    agent = create(client, "/users", {"kind": "agent"})
    assert agent["username"].startswith("agent-") and len(agent["generated_password"]) == 36
    assert "generated_password" not in client.get("/api/v1/users/" + agent["id"]).json()
    assert "password_hash" not in client.get("/api/v1/users").text


def test_permissions_and_revocation(client, project):
    agent = create(client, "/users", {"kind": "agent"})
    bearer = client.post(
        "/api/v1/auth/token",
        json={"username": agent["username"], "password": agent["generated_password"]},
    ).json()["access_token"]
    headers = {"Authorization": "Bearer " + bearer}
    assert client.get("/api/v1/projects/" + project["id"], headers=headers).status_code == 404
    path = f"/api/v1/projects/{project['id']}/permissions/{agent['id']}"
    grants = {"project": {"view": True}, "item": {"view": True, "create": True}}
    assert client.put(path, json={"expected_revision": 1, "grants": grants}).status_code == 200
    task = item(client, project)
    assert client.get("/api/v1/items/" + task["id"], headers=headers).status_code == 200
    assert (
        client.patch(
            "/api/v1/items/" + task["id"],
            headers={**headers, "If-Match": "1"},
            json={"title": "Not permitted"},
        ).status_code
        == 403
    )
    assert client.delete(path + "?expected_revision=2").status_code == 204
    assert client.get("/api/v1/items/" + task["id"], headers=headers).status_code == 404


def test_blocker_requirement_rollback_and_multiple(client, project):
    result = client.post(
        f"/api/v1/projects/{project['id']}/items",
        json={"title": "Invalid", "type": "task", "state": "blocked"},
    )
    assert result.status_code == 409
    assert client.get("/api/v1/items").json()["total"] == 0
    a, b = item(client, project, "A"), item(client, project, "B")
    dependent = item(
        client, project, "Dependent", state="blocked", blocked_by_item_ids=[a["id"], b["id"]]
    )
    assert dependent["blocker_summary"]["total"] == 2
    assert dependent["number"] == 3
    assert not dependent["blocker_summary"]["ready_to_resume"]


def test_ready_resume_rechecks_blocker_version(client, project):
    a = item(client, project, "Blocker")
    dependent = item(client, project, "Dependent", state="blocked", blocked_by_item_ids=[a["id"]])
    assert patch(client, "/items/" + a["id"], {"state": "done"}).status_code == 200
    ready = client.get("/api/v1/items/" + dependent["id"]).json()
    assert ready["state"] == "blocked" and ready["blocker_summary"]["ready_to_resume"]
    payload = {
        "expected_version": ready["version"],
        "blocker_revision": ready["blocker_summary"]["blocker_revision"],
    }
    patch(client, "/items/" + a["id"], {"state": "open"})
    assert client.post(f"/api/v1/items/{dependent['id']}/resume", json=payload).status_code == 409
    patch(client, "/items/" + a["id"], {"state": "done"})
    ready = client.get("/api/v1/items/" + dependent["id"]).json()
    result = client.post(
        f"/api/v1/items/{dependent['id']}/resume",
        json={
            "expected_version": ready["version"],
            "blocker_revision": ready["blocker_summary"]["blocker_revision"],
        },
    )
    assert result.json()["state"] == "in_progress"


def test_cancel_blocker_impact_atomic_reopen_and_history(client, project):
    a, b = item(client, project, "A"), item(client, project, "B")
    one = item(client, project, "One blocker", state="blocked", blocked_by_item_ids=[a["id"]])
    two = item(
        client, project, "Two blockers", state="blocked", blocked_by_item_ids=[a["id"], b["id"]]
    )
    impact = client.get(f"/api/v1/items/{a['id']}/cancellation-preview").json()
    payload = {"expected_version": impact["version"], "impact_revision": impact["impact_revision"]}
    assert client.post(f"/api/v1/items/{a['id']}/cancel", json=payload).status_code == 409
    assert client.get(f"/api/v1/items/{a['id']}").json()["state"] == "open"
    result = client.post(
        f"/api/v1/items/{a['id']}/cancel", json={**payload, "confirm_blocker_removal": True}
    )
    assert result.status_code == 200, result.text
    assert client.get(f"/api/v1/items/{one['id']}").json()["state"] == "open"
    assert client.get(f"/api/v1/items/{two['id']}").json()["state"] == "blocked"
    events = client.get(f"/api/v1/items/{one['id']}/activity").json()["items"]
    auto = next(e for e in events if e["action"] == "state_changed_automatically")
    assert auto["actor_kind"] == "system" and auto["cause"] == "blocker_cancelled"
    assert auto["initiated_by"] == client.get("/api/v1/auth/me").json()["id"]


def test_link_cycles_related_canonical_and_final_unlink(client, project):
    a = item(client, project, "A")
    dependent = item(client, project, "Dependent", state="blocked", blocked_by_item_ids=[a["id"]])
    a = client.get(f"/api/v1/items/{a['id']}").json()
    result = client.post(
        f"/api/v1/items/{a['id']}/links",
        headers={"If-Match": str(a["version"])},
        json={
            "relationship": "blocked_by",
            "target_item_id": dependent["id"],
            "expected_target_version": dependent["version"],
        },
    )
    assert result.status_code == 409 and result.json()["code"] == "link_cycle"
    edge = client.get(f"/api/v1/items/{dependent['id']}/links").json()["items"][0]
    result = client.delete(
        f"/api/v1/items/{dependent['id']}/links/{edge['id']}?item_version={dependent['version']}",
        headers={"If-Match": str(edge["version"])},
    )
    assert result.status_code == 200 and result.json()["automatic_state_changes"][0]["to"] == "open"
    assert client.get(f"/api/v1/items/{dependent['id']}").json()["state"] == "open"


def test_sprint_close_rollover_preserves_state(client, project):
    a = create(client, f"/projects/{project['id']}/sprints", {"name": "First"})
    b = create(client, f"/projects/{project['id']}/sprints", {"name": "Next"})
    a = client.post(
        f"/api/v1/sprints/{a['id']}/start", json={"expected_version": a["version"]}
    ).json()
    assert (
        client.post(
            f"/api/v1/sprints/{b['id']}/start", json={"expected_version": b["version"]}
        ).status_code
        == 409
    )
    work = item(client, project, "Continue", state="in_progress", sprint_id=a["id"])
    done = item(client, project, "Done", state="done", sprint_id=a["id"])
    item(client, project, "Cancelled", state="cancelled", sprint_id=a["id"])
    assert (
        client.post(
            f"/api/v1/sprints/{a['id']}/close", json={"expected_version": a["version"]}
        ).status_code
        == 409
    )
    result = client.post(
        f"/api/v1/sprints/{a['id']}/close",
        json={
            "expected_version": a["version"],
            "move_unfinished_to_sprint_id": b["id"],
            "destination_version": b["version"],
        },
    )
    assert result.status_code == 200, result.text
    moved = client.get(f"/api/v1/items/{work['id']}").json()
    assert moved["sprint_id"] == b["id"] and moved["state"] == "in_progress"
    assert patch(client, f"/items/{done['id']}", {"state": "open"}).status_code == 409
    assert (
        patch(client, f"/items/{done['id']}", {"state": "open", "sprint_id": None}).status_code
        == 200
    )


def test_stale_version_idempotency_and_query(client, project):
    task = item(client, project)
    assert (
        patch(client, f"/items/{task['id']}", {"priority": "high"}, task["version"]).status_code
        == 200
    )
    assert (
        patch(client, f"/items/{task['id']}", {"priority": "low"}, task["version"]).status_code
        == 412
    )
    url = f"/api/v1/projects/{project['id']}/items"
    body = {"title": "One write", "type": "bug"}
    a = client.post(url, json=body, headers={"Idempotency-Key": "one"})
    b = client.post(url, json=body, headers={"Idempotency-Key": "one"})
    assert a.json()["id"] == b.json()["id"]
    assert (
        client.post(
            url, json={**body, "title": "Different"}, headers={"Idempotency-Key": "one"}
        ).status_code
        == 409
    )
    assert client.get("/api/v1/items?type=bug&state=open&backlog=true").json()["total"] == 1
    assert client.get("/api/v1/items?sort=unsafe").status_code == 422


def test_comments_files_and_history_survive_deletion(client, project):
    task = item(client, project)
    comment = create(client, f"/items/{task['id']}/comments", {"body": "Text **markdown**"})
    assert (
        patch(
            client,
            f"/items/{task['id']}/comments/{comment['id']}",
            {"body": "Edited"},
            comment["version"],
        ).status_code
        == 200
    )
    upload = client.post(
        f"/api/v1/items/{task['id']}/attachments",
        files={"file": ("../notes.txt", b"plain <script>text</script>", "text/html")},
    )
    assert upload.status_code == 201, upload.text
    attachment = upload.json()
    preview = client.get(f"/api/v1/attachments/{attachment['id']}/preview")
    assert preview.json()["text"] == "plain <script>text</script>"
    assert (
        client.get(f"/api/v1/attachments/{attachment['id']}/content")
        .headers["content-disposition"]
        .startswith("attachment")
    )
    impact = client.get(f"/api/v1/items/{task['id']}/deletion-preview").json()
    result = client.delete(
        f"/api/v1/items/{task['id']}?impact_revision={impact['impact_revision']}",
        headers={"If-Match": str(impact["version"])},
    )
    assert result.status_code == 200, result.text
    assert client.get(f"/api/v1/items/{task['id']}").status_code == 404
    events = client.get(f"/api/v1/projects/{project['id']}/activity?item_id={task['id']}").json()[
        "items"
    ]
    assert {e["action"] for e in events} >= {
        "item_created",
        "item_deleted",
        "comment_added",
        "comment_edited",
        "attachment_added",
        "attachment_removed",
    }
    assert all("Text **markdown**" not in str(e) for e in events)


def test_database_constraints_and_append_only_activity(client, project):
    task = item(client, project)
    with pytest.raises(IntegrityError), transaction(client.app.state.engine, True) as c:
        c.execute(update(m.items).where(m.items.c.id == task["id"]).values(state="invalid"))
    with pytest.raises(IntegrityError), transaction(client.app.state.engine, True) as c:
        c.execute(update(m.activity).values(action="tampered"))


def test_concurrent_sprint_start_is_serialized(client, project):
    sprints = [
        create(client, f"/projects/{project['id']}/sprints", {"name": f"Sprint {n}"})
        for n in (1, 2)
    ]

    def start(sprint):
        try:
            with transaction(client.app.state.engine, True) as c:
                user = dict(
                    c.execute(select(m.users).where(m.users.c.username == "admin")).mappings().one()
                )
                PlannerService(c, user, client.app.state.settings).start_sprint(
                    sprint["id"], sprint["version"]
                )
            return "started"
        except DomainError as exc:
            return exc.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(start, sprints))
    assert sorted(results) == ["active_sprint_exists", "started"]
