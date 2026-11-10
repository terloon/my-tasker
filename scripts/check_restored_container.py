"""Read-only verification of the isolated restore rehearsal, using disposable fixture IDs."""

import json
from pathlib import Path

import httpx

fixture = json.loads(Path("/private/tmp/local-planner-test-fixture.json").read_text())
with httpx.Client(base_url="http://127.0.0.1:8082") as client:
    assert client.get("/health/ready").status_code == 200
    client.get("/api/v1/setup")
    client.headers["X-CSRF-Token"] = client.cookies["lp_csrf"]
    signed_in = client.post(
        "/api/v1/auth/login",
        json={
            "username": "review-admin",
            "password": "disposable-review-password",
        },
    )
    assert signed_in.status_code == 200
    projects = client.get("/api/v1/projects").json()
    items = client.get("/api/v1/items").json()
    assert projects["total"] == 1 and items["total"] == 5
    item = client.get("/api/v1/items/" + fixture["blocked_id"]).json()
    assert item["state"] == "in_progress"
    activity = client.get("/api/v1/items/" + item["id"] + "/activity").json()
    assert any(e["action"] == "item_resumed" for e in activity["items"])
    assert any(e["interface"] == "mcp" for e in activity["items"])
    content = client.get("/api/v1/attachments/" + fixture["attachment_id"] + "/content")
    assert content.content == b"# Acceptance notes\nAll five states are available.\n"
    assert (
        client.get("/api/v1/attachments/" + fixture["attachment_id"] + "/preview")
        .json()["text"]
        .startswith("# Acceptance")
    )
    print(
        json.dumps(
            {
                "status": "restored login, projects, items, activity and attachment bytes verified",
                "events": activity["total"],
            }
        )
    )
