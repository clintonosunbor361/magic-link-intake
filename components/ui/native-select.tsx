"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type NativeSelectProps = React.ComponentProps<"select"> & {
  submitOnChange?: boolean;
};

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
  submitOnChange = false,
  "aria-label": ariaLabel,
}: NativeSelectProps) {
  const id = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const options = React.useMemo(() => extractOptions(children), [children]);
  const initialValue = String(defaultValue ?? options[0]?.value ?? "");
  const [selected, setSelected] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const [justSelected, setJustSelected] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState<React.CSSProperties | null>(null);
  const selectedOption = options.find((option) => option.value === selected);

  React.useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
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

    function positionMenu() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const gap = 9;
      const viewportPadding = 12;
      const preferredHeight = Math.min(options.length * 48 + 16, 320);
      const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
      const spaceAbove = rect.top - gap - viewportPadding;
      const openAbove = spaceBelow < Math.min(preferredHeight, 180) && spaceAbove > spaceBelow;
      const availableHeight = Math.max(120, openAbove ? spaceAbove : spaceBelow);

      setMenuPosition({
        position: "fixed",
        left: rect.left,
        right: "auto",
        top: openAbove ? "auto" : rect.bottom + gap,
        bottom: openAbove ? window.innerHeight - rect.top + gap : "auto",
        width: rect.width,
        maxHeight: Math.min(preferredHeight, availableHeight),
        overflowY: "auto",
        zIndex: 100,
      });
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, options.length]);

  function choose(option: SelectOption) {
    if (option.disabled) return;
    if (option.value === selected) {
      setOpen(false);
      return;
    }
    setSelected(option.value);
    setOpen(false);
    setJustSelected(true);
    window.setTimeout(() => setJustSelected(false), 360);
    if (submitOnChange) {
      window.setTimeout(() => rootRef.current?.closest("form")?.requestSubmit(), 0);
    }
  }

  return (
    <div ref={rootRef} className="relative w-full">
      {name ? <input type="hidden" name={name} value={selected} required={required} /> : null}
      <button
        ref={triggerRef}
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

      {open && menuPosition ? createPortal(<div
        ref={menuRef}
        role="listbox"
        aria-labelledby={id}
        className="select-menu select-menu-open"
        style={menuPosition}
      >
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
      </div>, document.body) : null}
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

