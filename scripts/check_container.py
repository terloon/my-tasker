"""Seed and exercise ONLY an isolated, disposable test container on loopback port 8081."""

import asyncio
import json
from pathlib import Path

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

BASE = "http://127.0.0.1:8081"
USERNAME = "review-admin"
PASSWORD = "disposable-review-password"


async def main():
    async with httpx.AsyncClient(base_url=BASE, timeout=20) as client:
        ready = await client.get("/health/ready")
        assert ready.status_code == 200, ready.text
        status = (await client.get("/api/v1/setup")).json()
        client.headers["X-CSRF-Token"] = client.cookies["lp_csrf"]
        auth = await client.post(
            "/api/v1/setup" if status["setup_required"] else "/api/v1/auth/login",
            json={"username": USERNAME, "password": PASSWORD},
        )
        assert auth.status_code == 200, (
            "The isolated test account could not sign in; no existing accounts were changed."
        )
        client.headers["X-CSRF-Token"] = client.cookies["lp_csrf"]

        async def create(path, data):
            r = await client.post("/api/v1" + path, json=data)
            assert r.status_code == 201, r.text
            return r.json()

        projects = (await client.get("/api/v1/projects")).json()["items"]
        if projects:
            project = projects[0]
            all_items = (await client.get("/api/v1/items")).json()["items"]
            print(
                json.dumps(
                    {
                        "status": "existing test data retained",
                        "projects": len(projects),
                        "items": len(all_items),
                    }
                )
            )
            return
        project = await create(
            "/projects",
            {
                "key": "LOCAL",
                "name": "Local Planner",
                "description": "A local planning workspace shared by people and agents.",
            },
        )
        sprint = await create(
            f"/projects/{project['id']}/sprints", {"name": "Sprint 1 · Core workflow"}
        )
        await create(f"/projects/{project['id']}/sprints", {"name": "Sprint 2 · Collaboration"})
        r = await client.post(
            f"/api/v1/sprints/{sprint['id']}/start", json={"expected_version": sprint["version"]}
        )
        assert r.status_code == 200
        user = (await client.get("/api/v1/auth/me")).json()
        agent = await create("/users", {"kind": "agent", "display_name": "Calm Otter"})
        grants = {
            resource: {action: True for action in ("view", "create", "update", "delete")}
            for resource in ("project", "sprint", "item", "comment", "attachment")
        }
        grants["project"]["create"] = grants["project"]["delete"] = False
        r = await client.put(
            f"/api/v1/projects/{project['id']}/permissions/{agent['id']}",
            json={"expected_revision": 1, "grants": grants},
        )
        assert r.status_code == 200
        a = await create(
            f"/projects/{project['id']}/items",
            {
                "title": "Create the first administrator",
                "type": "task",
                "state": "done",
                "sprint_id": sprint["id"],
                "assignee_id": user["id"],
            },
        )
        b = await create(
            f"/projects/{project['id']}/items",
            {
                "title": "Create and order sprints",
                "type": "story",
                "state": "done",
                "sprint_id": sprint["id"],
            },
        )
        blocked = await create(
            f"/projects/{project['id']}/items",
            {
                "title": "Add attachment previews",
                "type": "task",
                "state": "blocked",
                "blocked_by_item_ids": [a["id"], b["id"]],
                "sprint_id": sprint["id"],
                "assignee_id": agent["id"],
                "description": "Preview common image and text files safely.\n\n- Preserve the original file\n- Keep previews bounded\n- Enforce project permissions",
            },
        )
        await create(
            f"/projects/{project['id']}/items",
            {
                "title": "Build the sprint board",
                "type": "story",
                "state": "in_progress",
                "priority": "high",
                "sprint_id": sprint["id"],
                "assignee_id": user["id"],
            },
        )
        await create(
            f"/projects/{project['id']}/items",
            {"title": "Write local startup instructions", "type": "task"},
        )
        r = await client.post(
            f"/api/v1/items/{blocked['id']}/attachments",
            files={
                "file": (
                    "acceptance-notes.md",
                    b"# Acceptance notes\nAll five states are available.\n",
                    "text/markdown",
                )
            },
        )
        assert r.status_code == 201, r.text
        file_id = r.json()["id"]
        assert (
            (await client.get(f"/api/v1/attachments/{file_id}/preview"))
            .json()["text"]
            .startswith("# Acceptance")
        )
        raw = (
            await client.post(
                "/api/v1/auth/token",
                json={"username": agent["username"], "password": agent["generated_password"]},
            )
        ).json()["access_token"]
        async with httpx.AsyncClient(headers={"Authorization": "Bearer " + raw}) as http:
            async with streamable_http_client(BASE + "/mcp", http_client=http) as (read, write, _):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools = await session.list_tools()
                    assert len(tools.tools) >= 40
                    result = await session.call_tool(
                        "create_comment",
                        {
                            "arguments": {
                                "item_id": blocked["id"],
                                "data": {
                                    "body": "The blocker items are Done. Ready for a human to resume this work."
                                },
                            }
                        },
                    )
                    assert not result.isError, result
                    history = await session.call_tool(
                        "list_activity",
                        {"arguments": {"project_id": project["id"], "item_id": blocked["id"]}},
                    )
                    assert any(
                        e["actor_kind"] == "agent" for e in history.structuredContent["items"]
                    )
        fixture = {
            "project_id": project["id"],
            "sprint_id": sprint["id"],
            "blocked_id": blocked["id"],
            "attachment_id": file_id,
        }
        Path("/private/tmp/local-planner-test-fixture.json").write_text(json.dumps(fixture))
        print(
            json.dumps(
                {
                    "status": "container REST + MCP checks passed",
                    "tools": len(tools.tools),
                    **fixture,
                }
            )
        )


if __name__ == "__main__":
    asyncio.run(main())
