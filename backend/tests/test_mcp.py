import asyncio

import httpx
from app.config import Settings
from app.main import create_app
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client


def test_real_mcp_handshake_tools_permissions_and_revocation(tmp_path):
    async def scenario():
        app = create_app(Settings(data_dir=tmp_path))
        async with app.router.lifespan_context(app):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://testserver"
            ) as admin:
                await admin.get("/api/v1/setup")
                admin.headers["X-CSRF-Token"] = admin.cookies["lp_csrf"]
                await admin.post(
                    "/api/v1/setup",
                    json={"username": "admin", "password": "temporary-test-password"},
                )
                admin.headers["X-CSRF-Token"] = admin.cookies["lp_csrf"]
                project = (
                    await admin.post("/api/v1/projects", json={"key": "MCP", "name": "MCP test"})
                ).json()
                agent = (await admin.post("/api/v1/users", json={"kind": "agent"})).json()
                grant_url = f"/api/v1/projects/{project['id']}/permissions/{agent['id']}"
                await admin.put(
                    grant_url,
                    json={
                        "expected_revision": 1,
                        "grants": {
                            "project": {"view": True},
                            "item": {"view": True, "create": True},
                        },
                    },
                )
                raw = (
                    await admin.post(
                        "/api/v1/auth/token",
                        json={
                            "username": agent["username"],
                            "password": agent["generated_password"],
                        },
                    )
                ).json()["access_token"]
                async with httpx.AsyncClient(
                    transport=transport, headers={"Authorization": "Bearer " + raw}
                ) as http:
                    async with streamable_http_client(
                        "http://testserver/mcp", http_client=http
                    ) as (read, write, _):
                        async with ClientSession(read, write) as session:
                            await session.initialize()
                            tools = await session.list_tools()
                            assert {t.name for t in tools.tools} >= {
                                "create_item",
                                "get_item",
                                "cancel_item",
                                "list_activity",
                                "resume_item",
                            }
                            created = await session.call_tool(
                                "create_item",
                                {
                                    "arguments": {
                                        "project_id": project["id"],
                                        "data": {"title": "Agent work", "type": "task"},
                                        "idempotency_key": "agent-create",
                                    }
                                },
                            )
                            assert not created.isError, created
                            item = created.structuredContent
                            assert item["state"] == "open"
                            denied = await session.call_tool(
                                "update_item",
                                {
                                    "arguments": {
                                        "item_id": item["id"],
                                        "expected_version": item["version"],
                                        "data": {"title": "Denied"},
                                    }
                                },
                            )
                            assert denied.isError
                            history = await session.call_tool(
                                "list_activity",
                                {"arguments": {"project_id": project["id"], "item_id": item["id"]}},
                            )
                            assert history.structuredContent["items"][0]["actor_kind"] == "agent"
                            await admin.delete(grant_url + "?expected_revision=2")
                            revoked = await session.call_tool(
                                "get_item", {"arguments": {"item_id": item["id"]}}
                            )
                            assert revoked.isError

    asyncio.run(scenario())
