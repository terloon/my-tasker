import { describe, expect, it } from "vitest";
import { type Item } from "./api/client";
import { orderAfter, orderBefore } from "./planning-order";
const items = ["a", "b", "c", "d"].map((id, n) => ({
  id,
  version: n + 1,
})) as Item[];
describe("sprint drag ordering", () => {
  it("moves upward before the target without changing versions or the source snapshot", () => {
    const result = orderBefore(items, "d", "b");
    expect(result.map((i) => i.id)).toEqual(["a", "d", "b", "c"]);
    expect(result.find((i) => i.id === "d")?.version).toBe(4);
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("moves downward before a target and can append to the end", () => {
    expect(orderBefore(items, "a", "d").map((i) => i.id)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
    expect(orderBefore(items, "a", null).map((i) => i.id)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
  });
  it("keeps a self-drop unchanged and rejects missing source or destination", () => {
    expect(orderBefore(items, "b", "b")).toBe(items);
    expect(() => orderBefore(items, "missing", "b")).toThrow("list changed");
    expect(() => orderBefore(items, "a", "missing")).toThrow("list changed");
  });
});

describe("filtered backlog ordering", () => {
  const backlog = [
    "hidden-a",
    "match-a",
    "hidden-b",
    "match-b",
    "hidden-c",
  ].map((id, n) => ({ id, version: n + 1, sprint_id: null })) as Item[];
  it("moves before a matching item without reversing hidden items", () => {
    const ordered = orderBefore(backlog, "match-b", "match-a");
    expect(ordered.map((i) => i.id)).toEqual([
      "hidden-a",
      "match-b",
      "match-a",
      "hidden-b",
      "hidden-c",
    ]);
    expect(
      ordered.filter((i) => i.id.startsWith("hidden")).map((i) => i.id),
    ).toEqual(["hidden-a", "hidden-b", "hidden-c"]);
  });
  it("moves after a matching item while retaining the complete backlog scope", () => {
    const ordered = orderAfter(backlog, "match-a", "match-b");
    expect(ordered.map((i) => i.id)).toEqual([
      "hidden-a",
      "hidden-b",
      "match-b",
      "match-a",
      "hidden-c",
    ]);
    expect(ordered.map((i) => i.version).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("supports global top/end moves even when the first/last items are hidden", () => {
    expect(orderBefore(backlog, "match-b", backlog[0].id)[0].id).toBe(
      "match-b",
    );
    expect(orderBefore(backlog, "match-a", null).at(-1)?.id).toBe("match-a");
  });
  it("appends after the last item and refuses missing neighbors", () => {
    expect(orderAfter(backlog, "match-a", "hidden-c").at(-1)?.id).toBe(
      "match-a",
    );
    expect(() => orderAfter(backlog, "match-a", "missing")).toThrow(
      "list changed",
    );
    expect(() => orderAfter(backlog, "missing", "match-a")).toThrow(
      "list changed",
    );
  });
});
