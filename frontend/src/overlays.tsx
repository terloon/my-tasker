import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, type MenuAction } from "./controls";

export default function Modal({
  title,
  subtitle,
  children,
  footer,
  onClose,
  wide = false,
  dirty = false,
  drawer = false,
  dismissible = true,
  hideBackdrop = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode | ((requestClose: () => void) => ReactNode);
  onClose: () => void;
  wide?: boolean;
  dirty?: boolean;
  drawer?: boolean;
  dismissible?: boolean;
  hideBackdrop?: boolean;
}) {
  const id = useId();
  const [guard, setGuard] = useState(false);
  function close() {
    if (!dismissible) return;
    if (dirty) setGuard(true);
    else onClose();
  }
  return (
    <>
      <Dialog
        open
        maxWidth={false}
        hideBackdrop={hideBackdrop}
        aria-labelledby={id}
        aria-describedby={subtitle ? `${id}-subtitle` : undefined}
        slotProps={{
          paper: {
            className: `modal${wide ? " wide" : ""}${drawer ? " drawer" : ""}`,
          },
          backdrop: { className: "planner-backdrop" },
        }}
        onClose={(_, reason) => {
          if (reason === "escapeKeyDown") close();
        }}
      >
        <div className="modal-head">
          <div>
            <h1 id={id}>{title}</h1>
            {subtitle && (
              <p className="modal-subtitle" id={`${id}-subtitle`}>
                {subtitle}
              </p>
            )}
          </div>
          {dismissible && (
            <Button
              className="btn ghost icon-btn"
              aria-label="Close dialog"
              onClick={close}
            >
              ×
            </Button>
          )}
        </div>
        <DialogContent className="modal-content">{children}</DialogContent>
        {footer && (
          <div className="modal-footer">
            {typeof footer === "function" ? footer(close) : footer}
          </div>
        )}
      </Dialog>
      {guard && (
        <Modal
          title="Discard this draft?"
          onClose={() => setGuard(false)}
          hideBackdrop
          footer={
            <>
              <Button className="btn" onClick={onClose}>
                Discard changes
              </Button>
              <Button
                className="btn primary"
                autoFocus
                onClick={() => setGuard(false)}
              >
                Keep editing
              </Button>
            </>
          }
        >
          <p>Your edits will be lost.</p>
        </Modal>
      )}
    </>
  );
}

export function MenuPopover({
  anchor,
  id,
  triggerId,
  actions,
  onClose,
}: {
  anchor: HTMLButtonElement;
  id: string;
  triggerId: string;
  actions: MenuAction[];
  onClose: () => void;
}) {
  return (
    <Menu
      open
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{
        paper: { className: "action-menu-paper" },
        list: { id, "aria-labelledby": triggerId, dense: true },
      }}
    >
      {actions.map((action) =>
        "to" in action ? (
          <MenuItem
            key={action.label}
            component={Link}
            to={action.to}
            onClick={onClose}
          >
            {action.label}
          </MenuItem>
        ) : (
          <MenuItem
            key={action.label}
            className={action.danger ? "danger-text" : undefined}
            onClick={() => {
              onClose();
              action.onSelect();
            }}
          >
            {action.label}
          </MenuItem>
        ),
      )}
    </Menu>
  );
}
