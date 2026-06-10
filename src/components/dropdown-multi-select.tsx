"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type DropdownMultiSelectOption = {
  value: string;
  label: string;
};

export function DropdownMultiSelect({
  options,
  selected,
  onChange,
  ariaLabel,
  dropup = false,
}: {
  options: DropdownMultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  ariaLabel?: string;
  dropup?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    listRef.current
      ?.querySelector(".active")
      ?.scrollIntoView({ block: "nearest" });
  }, [open]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const getSummary = () => {
    if (selected.length === 0) {
      return "None";
    }
    if (selected.length === options.length) {
      return "All";
    }
    // Sort selected values by their index in the options array to maintain order in summary
    const sortedSelected = [...selected].sort((a, b) => {
      const idxA = options.findIndex((opt) => opt.value === a);
      const idxB = options.findIndex((opt) => opt.value === b);
      return idxA - idxB;
    });
    return sortedSelected
      .map((val) => options.find((opt) => opt.value === val)?.label || val)
      .join(", ");
  };

  return (
    <span
      className="custom-select dropdown-multi-select"
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
        <span>{getSummary()}</span>
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
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={isSelected ? "active" : ""}
                  onClick={() => toggleOption(option.value)}
                >
                  {option.label}
                  {isSelected ? (
                    <Check size={14} aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </span>
  );
}
