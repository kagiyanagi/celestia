"use client";

import { ChevronDown, Minus, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { BrowseFilterOption } from "@/types/anime";

type MultiSelectProps = {
  options: BrowseFilterOption[];
  included: string[];
  excluded: string[];
  onChange: (included: string[], excluded: string[]) => void;
  ariaLabel?: string;
  /** Show a filter box inside the menu (useful for long lists like tags). */
  searchable?: boolean;
};

type OptionState = "none" | "included" | "excluded";

function summarize(included: string[], excluded: string[]): string {
  if (!included.length && !excluded.length) {
    return "Any";
  }

  const parts: string[] = [];
  if (included.length) {
    parts.push(included.length === 1 ? included[0] : `${included.length} added`);
  }
  if (excluded.length) {
    parts.push(`${excluded.length} excluded`);
  }
  return parts.join(" · ");
}

/**
 * Tri-state multi-select: each click cycles a value none -> included ->
 * excluded -> none, mapping to AniList's `_in` / `_not_in` filter pair. Built
 * on the same trigger + scrim + listbox shape as CustomSelect.
 */
export function MultiSelect({
  options,
  included,
  excluded,
  onChange,
  ariaLabel,
  searchable = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const includedSet = useMemo(() => new Set(included), [included]);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);

  // Focus the filter box on open. (Focus is a DOM side effect, not React state.)
  useEffect(() => {
    if (open && searchable) {
      searchRef.current?.focus();
    }
  }, [open, searchable]);

  function close() {
    setQuery("");
    setOpen(false);
  }

  const visibleOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return options;
    }
    return options.filter((option) =>
      option.label.toLowerCase().includes(trimmed),
    );
  }, [options, query]);

  function stateOf(value: string): OptionState {
    if (includedSet.has(value)) return "included";
    if (excludedSet.has(value)) return "excluded";
    return "none";
  }

  function cycle(value: string) {
    const current = stateOf(value);
    const nextIncluded = included.filter((item) => item !== value);
    const nextExcluded = excluded.filter((item) => item !== value);

    if (current === "none") {
      nextIncluded.push(value);
    } else if (current === "included") {
      nextExcluded.push(value);
    }

    onChange(nextIncluded, nextExcluded);
  }

  return (
    <span
      className="custom-select multi-select"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
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
        <span>{summarize(included, excluded)}</span>
        <ChevronDown size={16} className="custom-select-caret" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="custom-select-scrim"
            aria-label="Close menu"
            onClick={close}
          />
          <div
            className="custom-select-list multi-select-list"
            role="listbox"
            aria-label={ariaLabel}
            aria-multiselectable
          >
            {searchable ? (
              <div className="multi-select-search">
                <Search size={14} aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  placeholder="Filter..."
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            ) : null}

            {visibleOptions.length ? (
              visibleOptions.map((option) => {
                const state = stateOf(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={state !== "none"}
                    className={`multi-option ${state}`}
                    onClick={() => cycle(option.value)}
                  >
                    <span>{option.label}</span>
                    {state === "included" ? (
                      <Plus size={14} aria-hidden />
                    ) : state === "excluded" ? (
                      <Minus size={14} aria-hidden />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="multi-select-empty">No matches.</p>
            )}
          </div>
        </>
      ) : null}
    </span>
  );
}
