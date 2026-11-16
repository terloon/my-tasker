import { ApiError, type Item } from "./api/client";

/** Move within a complete, versioned list snapshot; null means the end. */
export function orderBefore(
  items: Item[],
  itemId: string,
  beforeId: string | null,
): Item[] {
  const source = items.find((i) => i.id === itemId);
  if (!source || (beforeId !== null && !items.some((i) => i.id === beforeId)))
    throw new ApiError(
      409,
      "order_scope_changed",
      "The list changed. Reload before reordering.",
    );
  if (itemId === beforeId) return items;
  const remaining = items.filter((i) => i.id !== itemId);
  const index =
    beforeId === null
      ? remaining.length
      : remaining.findIndex((i) => i.id === beforeId);
  remaining.splice(index, 0, source);
  return remaining;
}

/** Place after a visible neighbor while preserving hidden items' relative order. */
export function orderAfter(
  items: Item[],
  itemId: string,
  afterId: string,
): Item[] {
  if (!items.some((i) => i.id === afterId))
    return orderBefore(items, itemId, afterId);
  if (itemId === afterId) return orderBefore(items, itemId, afterId);
  const remaining = items.filter((i) => i.id !== itemId);
  const next = remaining[remaining.findIndex((i) => i.id === afterId) + 1];
  return orderBefore(items, itemId, next?.id ?? null);
}
