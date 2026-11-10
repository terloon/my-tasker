import { afterEach, describe, expect, it, vi } from "vitest";
import { allPages, query, reorderItem, type Item } from "./client";

afterEach(() => vi.unstubAllGlobals());
function responses(...bodies: unknown[]) {
  vi.stubGlobal("document", { cookie: "" });
  const fetcher = vi.fn();
  bodies.forEach((body) =>
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 200 }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const item = (id: string, version = 1) =>
  ({ id, version, project_id: "project", sprint_id: null }) as Item;

describe("item queries and ordering", () => {
  it("preserves repeated filters and explicit unassigned selection in shareable URLs", () => {
    const params = new URLSearchParams(
      query({
        state: ["open", "blocked"],
        unassigned: true,
        backlog: false,
        offset: 0,
      }),
    );
    expect(params.getAll("state")).toEqual(["open", "blocked"]);
    expect(params.get("unassigned")).toBe("true");
    expect(params.has("backlog")).toBe(false);
    expect(params.get("offset")).toBe("0");
  });
  it("loads every selector page without dropping filters", async () => {
    const fetcher = responses(
      { items: [item("a")], total: 2 },
      { items: [item("b")], total: 2 },
    );
    expect(
      (await allPages<Item>("/items?state=open")).items.map((i) => i.id),
    ).toEqual(["a", "b"]);
    expect(fetcher.mock.calls[1][0]).toContain("state=open");
    expect(fetcher.mock.calls[1][0]).toContain("offset=1");
  });
  it("rejects an ordering gesture from a stale item snapshot before writing", async () => {
    const fetcher = responses({ items: [item("a", 2), item("b")], total: 2 });
    await expect(reorderItem(item("a"), 1)).rejects.toMatchObject({
      status: 412,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("submits the full scope and versions when moving between pages", async () => {
    const fetcher = responses(
      { items: [item("a"), item("b", 3)], total: 3 },
      { items: [item("c", 4)], total: 3 },
      { success: true },
    );
    await reorderItem(item("b", 3), 1);
    const request = fetcher.mock.calls[2][1];
    expect(request.method).toBe("PUT");
    expect(JSON.parse(request.body)).toMatchObject({
      ordered_ids: ["a", "c", "b"],
      versions: { a: 1, b: 3, c: 4 },
    });
  });
});
