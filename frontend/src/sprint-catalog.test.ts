import { describe, expect, it } from "vitest";
import { type Sprint } from "./api/client";
import { reorderSprintStage, sprintStage } from "./sprint-catalog";
const all = [
  { id: "closed", state: "closed", version: 7 },
  { id: "first", state: "planned", version: 2 },
  { id: "active", state: "active", version: 4 },
  { id: "second", state: "planned", version: 1 },
] as Sprint[];
describe("sprint lifecycle views", () => {
  it("defaults missing, invalid and explicit planned views to Not started", () => {
    expect([null, "", "unknown", "planned"].map(sprintStage)).toEqual([
      "planned",
      "planned",
      "planned",
      "planned",
    ]);
    expect(sprintStage("active")).toBe("planned");
    expect(sprintStage("closed")).toBe("closed");
  });
  it("reorders unstarted neighbors while retaining active/closed positions and all versions", () => {
    const ordered = reorderSprintStage(all, "planned", "second", -1);
    expect(ordered.map((s) => s.id)).toEqual([
      "closed",
      "second",
      "active",
      "first",
    ]);
    expect(ordered.map((s) => s.version)).toEqual([7, 1, 4, 2]);
    expect(all.map((s) => s.id)).toEqual([
      "closed",
      "first",
      "active",
      "second",
    ]);
    expect(reorderSprintStage(ordered, "planned", "second", 1)).toEqual(all);
  });
  it("keeps group boundaries fixed and rejects sources outside the selected lifecycle", () => {
    expect(reorderSprintStage(all, "planned", "first", -1)).toBe(all);
    expect(reorderSprintStage(all, "planned", "second", 1)).toBe(all);
    expect(() => reorderSprintStage(all, "planned", "closed", 1)).toThrow(
      "sprint list changed",
    );
  });
  it("moves a sprint before or after a nonadjacent card without moving other states", () => {
    const third = { id: "third", state: "planned", version: 3 } as Sprint;
    const snapshot = [...all, third];
    const moved = reorderSprintStage(snapshot, "planned", "first", {
      targetId: "third",
      side: "after",
    });
    expect(moved.map((s) => s.id)).toEqual([
      "closed",
      "second",
      "active",
      "third",
      "first",
    ]);
    expect(
      reorderSprintStage(moved, "planned", "first", {
        targetId: "second",
        side: "before",
      }),
    ).toEqual(snapshot);
    expect(
      reorderSprintStage(snapshot, "planned", "first", {
        targetId: "second",
        side: "before",
      }),
    ).toBe(snapshot);
    expect(() =>
      reorderSprintStage(snapshot, "planned", "first", {
        targetId: "active",
        side: "after",
      }),
    ).toThrow("list changed");
  });
});
