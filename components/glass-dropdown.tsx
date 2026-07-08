"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type GlassDropdownProps<T extends string> = {
  label: string;
  name: string;
  options: readonly T[];
  defaultValue?: T;
  placeholder?: string;
};

export function GlassDropdown<T extends string>({
  label,
  name,
  options,
  defaultValue,
  placeholder = "Select an option",
}: GlassDropdownProps<T>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(defaultValue ?? "");
  const [justSelected, setJustSelected] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

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

  function choose(option: T) {
    setSelected(option);
    setOpen(false);
    setJustSelected(true);
    window.setTimeout(() => setJustSelected(false), 360);
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <label id={`${id}-label`} className="label" htmlFor={`${id}-button`}>
        {label}
      </label>
      <input type="hidden" name={name} value={selected} />
      <button
        id={`${id}-button`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => setOpen((current) => !current)}
        className={`select-field ${open ? "select-field-open" : ""} ${
          justSelected ? "select-field-selected" : ""
        }`}
      >
        <span
          id={`${id}-value`}
          className={`truncate pr-10 ${selected ? "" : "text-kuartz-muted"}`}
        >
          {selected || placeholder}
        </span>
        <ChevronDown
          className={`select-chevron ${open ? "select-chevron-open" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        role="listbox"
        aria-labelledby={`${id}-label`}
        className={`select-menu ${open ? "select-menu-open" : ""}`}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={selected === option}
            onClick={() => choose(option)}
            className={`select-option ${selected === option ? "select-option-active" : ""}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}