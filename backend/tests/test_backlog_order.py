from conftest import create, item


def test_backlog_order_is_global_persistent_and_does_not_change_fields(client, project):
    a = item(client, project, "Matching first", type="bug", priority="low")
    hidden = item(client, project, "Hidden middle", type="task", state="done")
    b = item(
        client, project, "Matching important", type="bug", priority="high", state="in_progress"
    )
    sprint = create(client, f"/projects/{project['id']}/sprints", {"name": "Other work"})
    assigned = item(client, project, "In sprint", sprint_id=sprint["id"])
    path = f"/api/v1/projects/{project['id']}/item-order"
    body = {
        "sprint_id": None,
        "ordered_ids": [b["id"], a["id"], hidden["id"]],
        "versions": {i["id"]: i["version"] for i in (a, hidden, b)},
    }
    # A filter is never the complete ordering scope.
    partial = {**body, "ordered_ids": [b["id"], a["id"]]}
    assert client.put(path, json=partial).status_code == 409
    assert client.put(path, json=body).status_code == 200
    current = client.get(
        "/api/v1/items",
        params={"project_id": project["id"], "backlog": True, "sort": "rank", "direction": "asc"},
    ).json()["items"]
    assert [i["id"] for i in current] == body["ordered_ids"]
    assert (
        current[0]["priority"] == "high"
        and current[0]["state"] == "in_progress"
        and current[0]["sprint_id"] is None
    )
    assert client.get(f"/api/v1/items/{assigned['id']}").json()["version"] == assigned["version"]
    filtered = client.get(
        "/api/v1/items",
        params={
            "project_id": project["id"],
            "backlog": True,
            "type": "bug",
            "sort": "rank",
            "direction": "asc",
            "offset": 1,
            "limit": 1,
        },
    ).json()
    assert filtered["total"] == 2 and filtered["items"][0]["id"] == a["id"]
    assert client.put(path, json=body).status_code == 412
    history = client.get(f"/api/v1/items/{b['id']}/activity").json()["items"]
    assert any(e["action"] == "reordered" and e["changes"]["rank"]["to"] == 1024 for e in history)


def test_backlog_reordering_requires_update_access_and_rejects_scope_change(client, project):
    a = item(client, project, "First")
    b = item(client, project, "Second")
    agent = create(client, "/users", {"kind": "agent"})
    client.put(
        f"/api/v1/projects/{project['id']}/permissions/{agent['id']}",
        json={
            "expected_revision": 1,
            "grants": {"project": {"view": True}, "item": {"view": True}},
        },
    )
    token = client.post(
        "/api/v1/auth/token",
        json={"username": agent["username"], "password": agent["generated_password"]},
    ).json()["access_token"]
    body = {
        "sprint_id": None,
        "ordered_ids": [b["id"], a["id"]],
        "versions": {i["id"]: i["version"] for i in (a, b)},
    }
    path = f"/api/v1/projects/{project['id']}/item-order"
    assert (
        client.put(path, json=body, headers={"Authorization": "Bearer " + token}).status_code == 403
    )
    c = item(client, project, "Concurrent addition")
    assert client.put(path, json=body).status_code == 409
    ordered = client.get(
        "/api/v1/items",
        params={"project_id": project["id"], "backlog": True, "sort": "rank", "direction": "asc"},
    ).json()["items"]
    assert [i["id"] for i in ordered] == [a["id"], b["id"], c["id"]]
