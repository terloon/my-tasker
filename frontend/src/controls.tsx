import ButtonBase from "@mui/material/ButtonBase";
import {
  lazy,
  Suspense,
  useId,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

export function Button(props: ComponentProps<"button">) {
  return <ButtonBase disableRipple {...props} />;
}

export type MenuAction = { label: string } & (
  { to: string } | { onSelect: () => void; danger?: boolean }
);

const MenuPopover = lazy(() =>
  import("./overlays").then((module) => ({ default: module.MenuPopover })),
);

export function ActionMenu({
  label,
  className,
  trigger,
  actions,
}: {
  label: string;
  className: string;
  trigger: ReactNode;
  actions: MenuAction[];
}) {
  const id = useId();
  const menuId = `${id}-menu`;
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <Button
        id={id}
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        aria-controls={anchor ? menuId : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        {trigger}
      </Button>
      {anchor && (
        <Suspense fallback={null}>
          <MenuPopover
            anchor={anchor}
            id={menuId}
            triggerId={id}
            actions={actions}
            onClose={close}
          />
        </Suspense>
      )}
    </>
  );
}
