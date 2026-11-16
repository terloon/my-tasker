const labels = { story: "Story", task: "Task", bug: "Bug" } as const;

/** Type shapes remain distinct without color; visible text supplies their names. */
export function TypeIcon({ type }: { type: string }) {
  if (!(type in labels)) return null;
  return (
    <svg
      className={"item-type-icon type-" + type}
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {type === "story" ? (
        <path d="M5 3.5h10v13l-5-3.3-5 3.3z" />
      ) : type === "task" ? (
        <>
          <rect x="3" y="3" width="14" height="14" rx="2" />
          <path d="m6.2 10 2.5 2.5 5-5" />
        </>
      ) : (
        <>
          <path d="M7 6V5a3 3 0 0 1 6 0v1M7.5 2.8 6 1.5m6.5 1.3L14 1.5" />
          <rect x="6" y="6" width="8" height="11" rx="4" />
          <path d="M10 7v9M3 6l3 2m-4 3h4m-3 5 3-2m11-8-3 2m4 3h-4m3 5-3-2" />
        </>
      )}
    </svg>
  );
}

export function ItemType({ type }: { type: string }) {
  if (!(type in labels)) return null;
  return (
    <span className="item-type-label">
      <TypeIcon type={type} />
      <span>{labels[type as keyof typeof labels]}</span>
    </span>
  );
}
