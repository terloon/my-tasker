from conftest import create, item


def link(client, source, relationship, target):
    path = f"/api/v1/items/{source['id']}"
    source_version = client.get(path).json()["version"]
    target_version = client.get(f"/api/v1/items/{target['id']}").json()["version"]
    response = client.post(
        path + "/links",
        headers={"If-Match": str(source_version)},
        json={
            "relationship": relationship,
            "target_item_id": target["id"],
            "expected_target_version": target_version,
        },
    )
    assert response.status_code == 201, response.text


def test_hierarchy_pages_whole_branches_and_keeps_filtered_ancestors(client, project):
    parent = item(client, project, "Parent", type="story")
    sprint = create(client, f"/projects/{project['id']}/sprints", {"name": "Sprint"})
    child = item(client, project, "Child", sprint_id=sprint["id"])
    leaf = item(client, project, "Grandchild", type="bug", sprint_id=sprint["id"])
    peer = item(client, project, "Peer")
    link(client, parent, "child", child)
    link(client, leaf, "parent", child)
    link(client, parent, "related", peer)
    path = "/api/v1/items/hierarchy"
    sort = {"sort": "key", "direction": "asc"}
    response = client.get(path, params={**sort, "limit": 1})
    assert response.status_code == 200, response.text
    page = response.json()
    assert page["total"] == 2
    assert [
        (row["id"], row["parent_id"], row["depth"], row["has_children"]) for row in page["items"]
    ] == [
        (parent["id"], None, 0, True),
        (child["id"], parent["id"], 1, True),
        (leaf["id"], child["id"], 2, False),
    ]
    second = client.get(path, params={**sort, "limit": 1, "offset": 1}).json()
    assert [row["id"] for row in second["items"]] == [peer["id"]]
    filtered = client.get(path, params={"type": "bug", "sprint_id": sprint["id"]}).json()
    assert filtered["total"] == 1
    assert [(row["id"], row["matches_filters"]) for row in filtered["items"]] == [
        (parent["id"], False),
        (child["id"], False),
        (leaf["id"], True),
    ]
    flat = client.get("/api/v1/items", params={"type": "bug"}).json()
    assert [row["id"] for row in flat["items"]] == [leaf["id"]]


def test_hierarchy_respects_project_item_visibility(client, project):
    restricted = create(client, "/projects", {"key": "SECRET", "name": "Restricted"})
    parent = item(client, restricted, "Restricted parent")
    child = item(client, restricted, "Restricted child")
    link(client, parent, "child", child)
    visible = item(client, project, "Visible item")
    agent = create(client, "/users", {"kind": "agent"})
    for scope, can_view_items in ((project, True), (restricted, False)):
        grant = client.put(
            f"/api/v1/projects/{scope['id']}/permissions/{agent['id']}",
            json={
                "expected_revision": 1,
                "grants": {"project": {"view": True}, "item": {"view": can_view_items}},
            },
        )
        assert grant.status_code == 200, grant.text
    token = client.post(
        "/api/v1/auth/token",
        json={"username": agent["username"], "password": agent["generated_password"]},
    ).json()["access_token"]
    response = client.get("/api/v1/items/hierarchy", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200, response.text
    assert [row["id"] for row in response.json()["items"]] == [visible["id"]]
