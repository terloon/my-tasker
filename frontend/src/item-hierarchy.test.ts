import { expect, it } from "vitest";
import type { HierarchyItem } from "./api/client";
import { visibleHierarchyItems } from "./item-hierarchy";

it("collapses an entire branch while preserving the order and state of other branches", () => {
  const items = [
    { id: "root", parent_id: null },
    { id: "child", parent_id: "root" },
    { id: "grandchild", parent_id: "child" },
    { id: "other-root", parent_id: null },
    { id: "other-child", parent_id: "other-root" },
  ] as HierarchyItem[];
  const visible = (collapsed: string[]) =>
    visibleHierarchyItems(items, new Set(collapsed)).map(({ id }) => id);
  expect(visible(["root", "child"])).toEqual([
    "root",
    "other-root",
    "other-child",
  ]);
  expect(visible(["child"])).toEqual([
    "root",
    "child",
    "other-root",
    "other-child",
  ]);
  expect(visible([])).toEqual(items.map(({ id }) => id));
});
