import type { HierarchyItem } from "./api/client";

export function visibleHierarchyItems(
  items: HierarchyItem[],
  collapsed: ReadonlySet<string>,
) {
  const hidden = new Set<string>();
  return items.filter((item) => {
    if (
      item.parent_id &&
      (collapsed.has(item.parent_id) || hidden.has(item.parent_id))
    ) {
      hidden.add(item.id);
      return false;
    }
    return true;
  });
}
