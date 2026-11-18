import { ApiError, type Sprint } from "./api/client";
import { orderAfter, orderBefore } from "./planning-order";

export type SprintPlacement = {
  targetId: string;
  side: "before" | "after";
};

export function sprintStage(value: string | null): "planned" | "closed" {
  return value === "closed" ? "closed" : "planned";
}

/** Move within one lifecycle group while retaining the full API scope. */
export function reorderSprintStage(
  all: Sprint[],
  stage: Sprint["state"],
  id: string,
  move: -1 | 1 | SprintPlacement,
): Sprint[] {
  const visible = all.filter((s) => s.state === stage);
  const index = visible.findIndex((s) => s.id === id);
  if (index < 0)
    throw new ApiError(
      409,
      "order_scope_changed",
      "The sprint list changed. Reload before reordering.",
    );
  const placement =
    typeof move === "number"
      ? {
          targetId: visible[index + move]?.id,
          side: move < 0 ? "before" : "after",
        }
      : move;
  if (!placement.targetId) return all;
  const ordered =
    placement.side === "before"
      ? orderBefore(visible, id, placement.targetId)
      : orderAfter(visible, id, placement.targetId);
  if (ordered.every((s, n) => s === visible[n])) return all;
  let next = 0;
  return all.map((s) => (s.state === stage ? ordered[next++] : s));
}
