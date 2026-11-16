from pathlib import Path

from alembic import command
from alembic.config import Config
from app import models as m
from app.config import Settings
from app.content import PlannerService
from app.db import make_engine, migrate, transaction
from conftest import create, item, patch
from sqlalchemy import select


def test_sprint_description_partial_edits_and_statistics(client, project):
    sprint = create(client, f"/projects/{project['id']}/sprints", {"name": "Legacy-style creation"})
    assert sprint["description"] == ""
    edited = patch(
        client, f"/sprints/{sprint['id']}", {"description": "## Goal\nShip a useful local planner."}
    ).json()
    assert edited["name"] == sprint["name"] and edited["description"].startswith("## Goal")
    renamed = patch(client, f"/sprints/{sprint['id']}", {"name": "Core workflow"}).json()
    assert renamed["description"] == edited["description"]
    assert (
        patch(
            client, f"/sprints/{sprint['id']}", {"description": "stale"}, sprint["version"]
        ).status_code
        == 412
    )
    assert patch(client, f"/sprints/{sprint['id']}", {"description": None}).status_code == 422
    assert patch(client, f"/sprints/{sprint['id']}", {}).status_code == 422
    for state in ("open", "in_progress", "done", "cancelled"):
        item(client, project, state, state=state, sprint_id=sprint["id"])
    result = client.get(f"/api/v1/sprints/{sprint['id']}").json()
    assert result["total"] == 4 and result["counts"] == {
        "open": 1,
        "open_question": 0,
        "in_progress": 1,
        "blocked": 0,
        "done": 1,
        "cancelled": 1,
    }
    assert (
        client.get(f"/api/v1/projects/{project['id']}/sprints").json()["items"][0]["description"]
        == edited["description"]
    )
    assert (
        client.get(f"/api/v1/sprints/{sprint['id']}/board").json()["sprint"]["description"]
        == edited["description"]
    )
    history = client.get(f"/api/v1/projects/{project['id']}/activity").json()["items"]
    assert any(
        e["action"] == "sprint_updated" and e["changes"].get("description", {}).get("from") == ""
        for e in history
    )
    assert (
        patch(client, f"/sprints/{sprint['id']}", {"description": ""}).json()["description"] == ""
    )


def test_planning_add_reorder_and_reject_stale_scope(client, project):
    sprint = create(
        client, f"/projects/{project['id']}/sprints", {"name": "Plan", "description": "Focus"}
    )
    a = item(client, project, "First", sprint_id=sprint["id"])
    b = item(client, project, "Second", sprint_id=sprint["id"])
    backlog = item(
        client, project, "Find this bug", type="bug", priority="high", state="in_progress"
    )
    extra = item(client, project, "Other task")
    found = client.get(
        "/api/v1/items",
        params={
            "project_id": project["id"],
            "backlog": True,
            "type": "bug",
            "state": "in_progress",
            "priority": "high",
            "q": "Find this",
        },
    ).json()
    assert [i["id"] for i in found["items"]] == [backlog["id"]]
    moved = client.post(
        f"/api/v1/projects/{project['id']}/items/bulk-move",
        json={"sprint_id": sprint["id"], "item_versions": {backlog["id"]: backlog["version"]}},
    )
    assert moved.status_code == 200
    backlog = client.get(f"/api/v1/items/{backlog['id']}").json()
    assert backlog["state"] == "in_progress" and backlog["sprint_id"] == sprint["id"]
    order = {
        "sprint_id": sprint["id"],
        "ordered_ids": [backlog["id"], a["id"], b["id"]],
        "versions": {i["id"]: i["version"] for i in (a, b, backlog)},
    }
    assert client.put(f"/api/v1/projects/{project['id']}/item-order", json=order).status_code == 200
    result = client.get(
        "/api/v1/items",
        params={
            "project_id": project["id"],
            "sprint_id": sprint["id"],
            "sort": "rank",
            "direction": "asc",
        },
    ).json()["items"]
    assert [i["id"] for i in result] == order["ordered_ids"]
    # A concurrent backlog move changes the complete ordering scope; no partial reorder commits.
    client.post(
        f"/api/v1/projects/{project['id']}/items/bulk-move",
        json={"sprint_id": sprint["id"], "item_versions": {extra["id"]: extra["version"]}},
    )
    assert client.put(f"/api/v1/projects/{project['id']}/item-order", json=order).status_code == 409


def test_open_questions_filter_and_block_start_until_returned_to_open(client, project):
    sprint = create(client, f"/projects/{project['id']}/sprints", {"name": "Plan"})
    sprint_path = f"/api/v1/sprints/{sprint['id']}"
    question = item(client, project, "Confirm the requirements", sprint_id=sprint["id"])
    item(client, project, "Other sprint work", sprint_id=sprint["id"])
    backlog_question = item(client, project, "Backlog question", state="open_question")
    flagged = patch(
        client, f"/items/{question['id']}", {"state": "open_question"}, question["version"]
    )
    assert flagged.status_code == 200
    filtered = client.get("/api/v1/items", params={"state": "open_question"}).json()
    assert {row["id"] for row in filtered["items"]} == {question["id"], backlog_question["id"]}
    board = client.get(f"{sprint_path}/board", params={"open_question_offset": 1}).json()
    assert board["columns"]["open_question"]["total"] == 1
    assert board["columns"]["open_question"]["items"] == []
    old_sprint = client.get(sprint_path).json()
    assert old_sprint["counts"]["open_question"] == 1

    start = client.post(f"{sprint_path}/start", json={"expected_version": sprint["version"]})
    assert start.status_code == 409
    assert start.json()["code"] == "sprint_open_questions"
    assert start.json()["details"] == {"count": 1}
    assert client.get(sprint_path).json() == old_sprint

    bypass = patch(client, f"/items/{question['id']}", {"state": "done"})
    assert bypass.status_code == 409 and bypass.json()["code"] == "question_must_return_to_open"
    item_path = f"/api/v1/items/{question['id']}"
    impact = client.get(f"{item_path}/cancellation-preview").json()
    bypass = client.post(
        f"{item_path}/cancel",
        json={"expected_version": impact["version"], "impact_revision": impact["impact_revision"]},
    )
    assert bypass.status_code == 409 and bypass.json()["code"] == "question_must_return_to_open"

    assert patch(client, f"/items/{question['id']}", {"state": "open"}).status_code == 200
    events = client.get(f"{item_path}/activity").json()["items"]
    assert any(e["changes"].get("state") == {"from": "open_question", "to": "open"} for e in events)
    start = client.post(f"{sprint_path}/start", json={"expected_version": sprint["version"]})
    assert start.status_code == 200
    assert start.json()["state"] == "active"


def test_sprint_start_checks_questions_without_revealing_unviewable_items(client, project):
    sprint = create(client, f"/projects/{project['id']}/sprints", {"name": "Plan"})
    item(client, project, "Private question", sprint_id=sprint["id"], state="open_question")
    user = create(client, "/users", {"kind": "agent"})
    grant = client.put(
        f"/api/v1/projects/{project['id']}/permissions/{user['id']}",
        json={
            "expected_revision": 1,
            "grants": {"project": {"view": True}, "sprint": {"view": True, "update": True}},
        },
    )
    assert grant.status_code == 200
    token = client.post(
        "/api/v1/auth/token",
        json={"username": user["username"], "password": user["generated_password"]},
    ).json()["access_token"]
    result = client.post(
        f"/api/v1/sprints/{sprint['id']}/start",
        json={"expected_version": sprint["version"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert result.status_code == 409
    assert result.json()["code"] == "sprint_open_questions"
    assert result.json()["details"] == {}


def test_upgrade_keeps_existing_sprint_and_items(tmp_path):
    settings = Settings(data_dir=tmp_path)
    engine = make_engine(settings)
    base = Path(__file__).resolve().parents[1]
    config = Config(str(base / "alembic.ini"))
    config.set_main_option("script_location", str(base / "migrations"))
    with engine.connect() as c:
        config.attributes["connection"] = c
        command.upgrade(config, "0001")
    with transaction(engine, True) as c:
        c.exec_driver_sql(
            "INSERT INTO users VALUES ('u','legacy-admin','Admin','human',1,1,'unused','2026-11-01','2026-11-01',1)"
        )
        c.exec_driver_sql(
            "INSERT INTO projects VALUES ('p','OLD','Existing project','',2,'u',1,'2026-11-01','2026-11-01',1)"
        )
        c.exec_driver_sql(
            "INSERT INTO sprints VALUES ('s','p','Existing sprint',1024,'active','2026-11-01',NULL,'2026-11-01','2026-11-01',7)"
        )
        c.exec_driver_sql(
            "INSERT INTO items VALUES ('i','p',1,'Existing work','','task','in_progress','high',NULL,'u','s',2048,'2026-11-01','2026-11-01',3)"
        )
        c.exec_driver_sql(
            "INSERT INTO items VALUES ('child','p',2,'Child item','','task','open','high',NULL,'u','s',3072,'2026-11-01','2026-11-01',1)"
        )
        c.exec_driver_sql(
            "INSERT INTO item_links VALUES ('link','p','parent_child','i','child','u','2026-11-01',1)"
        )
        c.exec_driver_sql(
            "INSERT INTO labels VALUES ('label','p','Existing label','existing label',1)"
        )
        c.exec_driver_sql("INSERT INTO item_labels VALUES ('p','i','label')")
        c.exec_driver_sql(
            "INSERT INTO comments VALUES ('comment','p','i','u','u','Existing comment','2026-11-01','2026-11-01',1)"
        )
        c.exec_driver_sql(
            "INSERT INTO attachments VALUES ('attachment','p','i','u','notes.txt','key','text/plain',5,'checksum','text','ready','2026-11-01',1)"
        )
        c.exec_driver_sql(
            "INSERT INTO storage_jobs VALUES ('job','attachment','key',NULL,'delete',0,'2026-11-01')"
        )
    migrate(engine)
    with transaction(engine, True) as c:
        sprint = dict(c.execute(select(m.sprints)).mappings().one())
        assert (
            sprint["description"] == "" and sprint["version"] == 7 and sprint["state"] == "active"
        )
        work = dict(c.execute(select(m.items).where(m.items.c.id == "i")).mappings().one())
        assert work["sprint_id"] == "s" and work["version"] == 3 and work["rank"] == 2048
        for table, value in (
            ("item_links", "child"),
            ("item_labels", "label"),
            ("comments", "Existing comment"),
            ("attachments", "notes.txt"),
            ("storage_jobs", "attachment"),
        ):
            assert value in c.exec_driver_sql(f"SELECT * FROM {table}").one()
        assert c.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
        assert c.exec_driver_sql("PRAGMA foreign_key_check").all() == []
        user = dict(c.execute(select(m.users)).mappings().one())
        updated = PlannerService(c, user, settings).update_sprint(
            "s", {"description": "Added after upgrade"}, 7
        )
        assert (
            updated["name"] == "Existing sprint" and updated["description"] == "Added after upgrade"
        )
    engine.dispose()
