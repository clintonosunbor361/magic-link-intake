"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type NativeSelectProps = React.ComponentProps<"select">;

type SelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

export function NativeSelect({
  className,
  children,
  defaultValue,
  name,
  required,
  disabled,
  "aria-label": ariaLabel,
}: NativeSelectProps) {
  const id = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const options = React.useMemo(() => extractOptions(children), [children]);
  const initialValue = String(defaultValue ?? options[0]?.value ?? "");
  const [selected, setSelected] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const [justSelected, setJustSelected] = React.useState(false);
  const selectedOption = options.find((option) => option.value === selected);

  React.useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(option: SelectOption) {
    if (option.disabled) return;
    setSelected(option.value);
    setOpen(false);
    setJustSelected(true);
    window.setTimeout(() => setJustSelected(false), 360);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      {name ? <input type="hidden" name={name} value={selected} required={required} /> : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          `select-field ${open ? "select-field-open" : ""} ${justSelected ? "select-field-selected" : ""}`,
          "min-h-[3.15rem]",
          disabled ? "cursor-not-allowed opacity-60" : "",
          className,
        )}
      >
        <span className={cn("truncate pr-10", selectedOption?.value ? "" : "text-kuartz-muted")}>
          {selectedOption?.label ?? "Select an option"}
        </span>
        <ChevronDown className={`select-chevron ${open ? "select-chevron-open" : ""}`} aria-hidden="true" />
      </button>

      <div role="listbox" aria-labelledby={id} className={`select-menu ${open ? "select-menu-open" : ""}`}>
        {options.map((option) => (
          <button
            key={`${option.value}-${option.label}`}
            type="button"
            role="option"
            disabled={option.disabled}
            aria-selected={selected === option.value}
            onClick={() => choose(option)}
            className={cn(
              "select-option",
              selected === option.value ? "select-option-active" : "",
              option.disabled ? "cursor-not-allowed opacity-50 hover:translate-x-0 hover:bg-transparent" : "",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function extractOptions(children: React.ReactNode): SelectOption[] {
  return React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => {
      const props = child.props as { value?: string; disabled?: boolean; children?: React.ReactNode };
      const label = React.Children.toArray(props.children).join("");
      return {
        value: props.value ?? label,
        label,
        disabled: Boolean(props.disabled),
      };
    });
}

