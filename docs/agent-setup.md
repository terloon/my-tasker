# Local agent connection

1. Sign in as a human administrator and create an Agent under Users.
2. Copy its generated username and UUID password. The secret is shown only once.
3. In each applicable project's Permissions screen, grant Project View and the required resource CRUD rights. A write grant also needs View; comments/files need Item View. Do not grant more than the agent needs.
4. Exchange username/password at `POST /api/v1/auth/token`. Keep the returned opaque token in local secret/environment configuration.
5. Configure a Streamable HTTP MCP client for `http://127.0.0.1:8080/mcp` with an `Authorization: Bearer ...` header. This implementation uses local header authentication. OAuth-only clients and remote/cloud access are outside this version.

The official Python MCP SDK **1.30.0** is pinned and covered by an actual protocol handshake/discovery/tool-call test. Example using its client API:

```python
import asyncio
import os
import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

async def main():
    async with httpx.AsyncClient(headers={
        "Authorization": "Bearer " + os.environ["PLANNER_API_TOKEN"]
    }) as http:
        async with streamable_http_client(
            os.environ.get("PLANNER_URL", "http://127.0.0.1:8080") + "/mcp",
            http_client=http,
        ) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("query_items", {
                    "arguments": {"query": {"state": ["open", "blocked"]}}
                })
                print(result.structuredContent)

asyncio.run(main())
```

Discover tools and their typed schemas with `list_tools()`. Tools use a typed `arguments` object. Mutation tools accept expected versions and optional idempotency keys. Reads return structured data; failures contain structured domain errors marked as tool errors. No tools manage accounts/permissions, execute commands/SQL, browse arbitrary paths, or fetch arbitrary URLs.

Useful tools include `query_items`, `get_item`, `create_item`, `update_item`, `list_activity`, `create_comment`, sprint planning/lifecycle, labels, links, and attachments. `attach_file` accepts bounded base64 content up to 1 MiB decoded; larger files use authenticated REST multipart upload.

Blocked work needs Blocked by links. Readiness never authorizes an automatic resume: explicitly call `resume_item`. Cancellation/deletion requires the preview's current impact revision and acknowledgment; removing the last blocker automatically produces Open. Both REST and MCP check the same permissions and record the actual agent as actor.

For a local sibling container, join `local-planner` and use `http://app:8080/mcp`. Keep the host port on loopback. Tokens expire after 24 hours by default; exchange the stored username/UUID password again when needed. Rotating the password or disabling the user revokes prior tokens. Revoked project grants take effect on the next tool call, including already connected clients.
