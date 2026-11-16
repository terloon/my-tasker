import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useId, type ReactNode } from "react";

type Option = {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type Props = {
  options: Option[];
  className?: string;
  disabled?: boolean;
  optionsDisabled?: boolean;
  emptyLabel?: string;
  unavailableLabel?: string;
} & (
  { title: string; ariaLabel?: never } | { title?: never; ariaLabel: string }
) &
  (
    | { multiple?: false; value: string; onChange: (value: string) => void }
    | { multiple: true; value: string[]; onChange: (value: string[]) => void }
  );

export default function SelectField(props: Props) {
  const id = useId();
  const selected = props.multiple ? props.value : [props.value];
  const choices = [...props.options];
  for (const value of selected) {
    if (!choices.some((option) => option.value === value)) {
      choices.push({
        value,
        label: props.unavailableLabel ?? "Unavailable",
        disabled: !props.multiple,
      });
    }
  }
  const selectedText = selected
    .map((value) => choices.find((option) => option.value === value)?.label)
    .join(", ");

  const select = (
    <Select<string | string[]>
      className={`planner-select ${props.className ?? ""}`}
      labelId={props.title ? id : undefined}
      inputProps={{ "aria-label": props.ariaLabel }}
      value={props.value}
      multiple={props.multiple}
      disabled={props.disabled}
      displayEmpty
      MenuProps={{
        slotProps: {
          paper: { className: "action-menu-paper planner-select-menu" },
        },
      }}
      renderValue={
        props.multiple
          ? () =>
              selectedText || (
                <span className="muted">
                  {props.emptyLabel ?? "None selected"}
                </span>
              )
          : undefined
      }
      onChange={(event) => {
        const value = event.target.value;
        if (props.multiple) {
          props.onChange(
            Array.isArray(value) ? value : value.split(",").filter(Boolean),
          );
        } else if (typeof value === "string") {
          props.onChange(value);
        }
      }}
    >
      {choices.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          disabled={props.optionsDisabled || option.disabled}
        >
          <span className="planner-select-option">
            {props.multiple && (
              <span
                className="planner-select-check"
                data-checked={selected.includes(option.value)}
                aria-hidden="true"
              >
                {selected.includes(option.value) ? "✓" : ""}
              </span>
            )}
            {option.icon}
            <span>{option.label}</span>
          </span>
        </MenuItem>
      ))}
      {!choices.length && <MenuItem disabled>No options available</MenuItem>}
    </Select>
  );

  return props.title ? (
    <div className="field">
      <span id={id}>{props.title}</span>
      {select}
    </div>
  ) : (
    select
  );
}
