import { ApiError, type Sprint } from "./api/client";

export function sprintStage(value: string | null): "planned" | "closed" {
  return value === "closed" ? "closed" : "planned";
}

/** Swap two neighbors in one lifecycle group while retaining the full API scope. */
export function reorderSprintStage(
  all: Sprint[],
  stage: Sprint["state"],
  id: string,
  delta: -1 | 1,
): Sprint[] {
  const visible = all.filter((s) => s.state === stage);
  const index = visible.findIndex((s) => s.id === id);
  if (index < 0)
    throw new ApiError(
      409,
      "order_scope_changed",
      "The sprint list changed. Reload before reordering.",
    );
  const neighbor = visible[index + delta];
  if (!neighbor) return all;
  const result = [...all];
  const sourceIndex = result.findIndex((s) => s.id === id);
  const targetIndex = result.findIndex((s) => s.id === neighbor.id);
  [result[sourceIndex], result[targetIndex]] = [
    result[targetIndex],
    result[sourceIndex],
  ];
  return result;
}
