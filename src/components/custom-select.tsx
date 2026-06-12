"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type CustomSelectOption = {
  value: string;
  label: string;
};

/**
 * Styled replacement for native <select> - trigger button plus an absolute
 * listbox, closed by a transparent fixed scrim or Escape.
 */
export function CustomSelect({
  value,
  options,
  onChange,
  ariaLabel,
  dropup = false,
}: {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  dropup?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) {
      return;
    }

    listRef.current
      ?.querySelector(".active")
      ?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <span
      className="custom-select"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || value || "Any"}</span>
        <ChevronDown size={16} className="custom-select-caret" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="custom-select-scrim"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            className={`custom-select-list${dropup ? " dropup" : ""}`}
            role="listbox"
            aria-label={ariaLabel}
            ref={listRef}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "active" : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
                {option.value === value ? (
                  <Check size={14} aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </span>
  );
}
