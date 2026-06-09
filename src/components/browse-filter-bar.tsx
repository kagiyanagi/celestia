"use client";

import {
  ArrowDown01,
  ArrowDown10,
  Captions,
  Filter,
  RotateCcw,
  Save,
  Search,
  Shuffle,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { CustomSelect } from "@/components/custom-select";
import { MultiSelect } from "@/components/multi-select";

import {
  COUNTRY_OPTIONS,
  EMPTY_BROWSE_FILTERS,
  FORMAT_OPTIONS,
  getDefaultBrowseSort,
  getHiddenBrowseFilters,
  getYearOptions,
  joinListFilter,
  LIST_OPTIONS,
  SCORE_OPTIONS,
  SEASON_OPTIONS,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  splitListFilter,
  STATUS_OPTIONS,
} from "@/lib/browse-filters";
import {
  loadFilterPresets,
  loadRecentSearches,
  pushRecentSearch,
  saveFilterPreset,
  deleteFilterPreset,
  type FilterPreset,
} from "@/lib/browse-client-store";
import type {
  BrowseFilterOption,
  BrowseFilterOptions,
  BrowseFilters,
  BrowseSectionKey,
} from "@/types/anime";

type BrowseFilterBarProps = {
  basePath: string;
  section: BrowseSectionKey;
  filters: BrowseFilters;
  options: BrowseFilterOptions;
};

type SelectFieldProps = {
  label: string;
  name: keyof BrowseFilters;
  value: string;
  options: BrowseFilterOption[];
  includeAny?: boolean;
  onChange: (name: keyof BrowseFilters, value: string) => void;
};

function buildFilterUrl(basePath: string, filters: BrowseFilters): string {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && !(key === "sortOrder" && value === "desc")) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}

function SelectField({
  label,
  name,
  value,
  options,
  includeAny = true,
  onChange,
}: SelectFieldProps) {
  const allOptions = includeAny
    ? [{ value: "", label: "Any" }, ...options]
    : options;

  return (
    <div className="browse-filter-field">
      <span>{label}</span>
      <CustomSelect
        value={value}
        options={allOptions}
        ariaLabel={label}
        onChange={(nextValue) => onChange(name, nextValue)}
      />
    </div>
  );
}

export function BrowseFilterBar({
  basePath,
  section,
  filters,
  options,
}: BrowseFilterBarProps) {
  const router = useRouter();
  const { loading, refreshUser } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const defaultSort = getDefaultBrowseSort(section);
  const hidden = getHiddenBrowseFilters(section);
  const [values, setValues] = useState<BrowseFilters>({
    ...filters,
    sort: filters.sort || defaultSort,
    sortOrder: filters.sortOrder || "desc",
  });
  const yearOptions = getYearOptions();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Hydrate client-only storage after mount (deferred so it never runs
  // synchronously in the effect body, and the first render matches the server).
  useEffect(() => {
    queueMicrotask(() => {
      setPresets(loadFilterPresets(section));
      setRecentSearches(loadRecentSearches());
    });
  }, [section]);

  // Press "/" anywhere (outside an input) to jump to the search box.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const clearValues: BrowseFilters = {
    ...EMPTY_BROWSE_FILTERS,
    sort: defaultSort,
    sortOrder: "desc",
  };
  const hasActiveFilters = Object.entries(values).some(([key, value]) => {
    if (key === "sort") {
      return value !== defaultSort;
    }

    if (key === "sortOrder") {
      return value !== "desc";
    }

    return Boolean(value);
  });

  function applyFilters(nextValues: BrowseFilters) {
    startTransition(() => {
      router.push(buildFilterUrl(basePath, nextValues));
    });
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setValues((currentValues) => ({
      ...currentValues,
      q: event.target.value,
    }));
  }

  function handleSelectChange(name: keyof BrowseFilters, value: string) {
    const nextValues: BrowseFilters = {
      ...values,
      [name]: value,
    };

    setValues(nextValues);
    applyFilters(nextValues);
  }

  function handleMultiChange(
    includeKey: keyof BrowseFilters,
    excludeKey: keyof BrowseFilters,
    included: string[],
    excluded: string[],
  ) {
    const nextValues: BrowseFilters = {
      ...values,
      [includeKey]: joinListFilter(included),
      [excludeKey]: joinListFilter(excluded),
    };

    setValues(nextValues);
    applyFilters(nextValues);
  }

  // Episode bounds are free text; commit on blur/Enter rather than per keystroke
  // so we don't fire a navigation for every digit.
  function handleEpisodeCommit(name: "episodesMin" | "episodesMax") {
    if (values[name] === filters[name]) {
      return;
    }
    applyFilters(values);
  }

  function handleSortOrderToggle() {
    const nextValues: BrowseFilters = {
      ...values,
      sortOrder: values.sortOrder === "asc" ? "desc" : "asc",
    };

    setValues(nextValues);
    applyFilters(nextValues);
  }

  function handleDubbedToggle() {
    handleSelectChange("dubbed", values.dubbed === "1" ? "" : "1");
  }

  function handleClearFilters() {
    setValues(clearValues);
    startTransition(() => {
      router.push(basePath);
    });
  }

  async function handleRefresh() {
    setIsRefreshing(true);

    try {
      await refreshUser();
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSurprise() {
    const params = new URLSearchParams({ section });
    Object.entries(values).forEach(([key, value]) => {
      if (value && key !== "list" && key !== "dubbed") {
        params.set(key, value);
      }
    });

    try {
      const response = await fetch(`/api/browse?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        collection?: { items?: Array<{ id: number }> };
      };
      const items = payload.collection?.items || [];
      if (!items.length) {
        return;
      }
      const pick = items[Math.floor(Math.random() * items.length)];
      router.push(`/anime/${pick.id}`);
    } catch {
      // Surprise is best-effort; ignore failures.
    }
  }

  function handleSavePreset() {
    const name = window.prompt("Name this filter preset:");
    if (!name?.trim()) {
      return;
    }
    setPresets(saveFilterPreset(section, name.trim(), values));
  }

  function handleApplyPreset(preset: FilterPreset) {
    const nextValues: BrowseFilters = {
      ...EMPTY_BROWSE_FILTERS,
      ...preset.filters,
      sort: preset.filters.sort || defaultSort,
      sortOrder: preset.filters.sortOrder || "desc",
    };
    setValues(nextValues);
    applyFilters(nextValues);
  }

  function handleDeletePreset(id: string) {
    setPresets(deleteFilterPreset(section, id));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = values.q.trim();
    if (query) {
      setRecentSearches(pushRecentSearch(query));
    }
    applyFilters({
      ...values,
      q: query,
    });
  }

  return (
    <form
      className={`browse-filter-panel${isPending ? " is-pending" : ""}`}
      action={basePath}
      onSubmit={handleSubmit}
    >
      <label className="browse-search-field">
        <span>Search</span>
        <span className="browse-search-control">
          <Search size={20} aria-hidden />
          <input
            name="q"
            ref={searchInputRef}
            value={values.q}
            onChange={handleSearchChange}
            placeholder="Search anime...  (press / )"
            autoComplete="off"
            list="browse-recent-searches"
          />
          {recentSearches.length ? (
            <datalist id="browse-recent-searches">
              {recentSearches.map((term) => (
                <option key={term} value={term} />
              ))}
            </datalist>
          ) : null}
        </span>
      </label>

      <div className="browse-filter-actions" aria-label="Search controls">
        <button
          type="button"
          className={`list-action-button${values.dubbed === "1" ? " is-active" : ""}`}
          aria-label="Show dubbed only"
          aria-pressed={values.dubbed === "1"}
          title="Dubbed only (this page)"
          onClick={handleDubbedToggle}
        >
          <Captions size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="list-action-button"
          aria-label="Surprise me"
          title="Surprise me"
          onClick={() => void handleSurprise()}
        >
          <Shuffle size={18} aria-hidden />
        </button>
        <button
          type="button"
          className={`list-action-button${isRefreshing ? " is-refreshing" : ""}`}
          aria-label="Refresh results"
          title="Refresh results"
          onClick={() => void handleRefresh()}
          disabled={loading || isRefreshing}
        >
          <RotateCcw size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="list-action-button"
          aria-label={
            values.sortOrder === "asc" ? "Sort descending" : "Sort ascending"
          }
          title={
            values.sortOrder === "asc" ? "Sort descending" : "Sort ascending"
          }
          onClick={handleSortOrderToggle}
        >
          {values.sortOrder === "asc" ? (
            <ArrowDown01 size={18} aria-hidden />
          ) : (
            <ArrowDown10 size={18} aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="list-action-button"
          aria-label="Save filter preset"
          title="Save current filters as a preset"
          onClick={handleSavePreset}
          disabled={!hasActiveFilters}
        >
          <Save size={18} aria-hidden />
        </button>
        <button
          type="button"
          className="list-action-button clear-filter-button"
          aria-label="Clear filters"
          title="Clear filters"
          onClick={handleClearFilters}
          disabled={!hasActiveFilters}
        >
          <Trash2 size={18} aria-hidden />
        </button>
        <button
          className="browse-filter-toggle"
          type="button"
          aria-label={isExpanded ? "Collapse filters" : "Expand filters"}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          <Filter size={22} aria-hidden />
        </button>
      </div>

      {presets.length ? (
        <div className="browse-preset-row" aria-label="Saved filter presets">
          {presets.map((preset) => (
            <span className="browse-preset-chip" key={preset.id}>
              <button type="button" onClick={() => handleApplyPreset(preset)}>
                {preset.name}
              </button>
              <button
                type="button"
                className="browse-preset-remove"
                aria-label={`Delete preset ${preset.name}`}
                onClick={() => handleDeletePreset(preset.id)}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {isExpanded && (
        <div className="browse-filter-grid">
          <div className="browse-filter-field">
            <span>Genres</span>
            <MultiSelect
              ariaLabel="Genres"
              options={options.genres}
              included={splitListFilter(values.genre)}
              excluded={splitListFilter(values.genreExclude)}
              onChange={(included, excluded) =>
                handleMultiChange("genre", "genreExclude", included, excluded)
              }
            />
          </div>
          {!hidden.has("format") ? (
            <SelectField
              label="Format"
              name="format"
              value={values.format}
              options={FORMAT_OPTIONS}
              onChange={handleSelectChange}
            />
          ) : null}
          {!hidden.has("yearMin") ? (
            <div className="browse-filter-field">
              <span>Year</span>
              <div className="browse-range-pair">
                <CustomSelect
                  value={values.yearMin}
                  options={[{ value: "", label: "From" }, ...yearOptions]}
                  ariaLabel="Year from"
                  onChange={(value) => handleSelectChange("yearMin", value)}
                />
                <CustomSelect
                  value={values.yearMax}
                  options={[{ value: "", label: "To" }, ...yearOptions]}
                  ariaLabel="Year to"
                  onChange={(value) => handleSelectChange("yearMax", value)}
                />
              </div>
            </div>
          ) : null}
          <SelectField
            label="Sort"
            name="sort"
            value={values.sort}
            options={SORT_OPTIONS}
            includeAny={false}
            onChange={handleSelectChange}
          />
          {!hidden.has("season") ? (
            <SelectField
              label="Season"
              name="season"
              value={values.season}
              options={SEASON_OPTIONS}
              onChange={handleSelectChange}
            />
          ) : null}
          {!hidden.has("status") ? (
            <SelectField
              label="Airing Status"
              name="status"
              value={values.status}
              options={STATUS_OPTIONS}
              onChange={handleSelectChange}
            />
          ) : null}
          <SelectField
            label="Min Score"
            name="scoreMin"
            value={values.scoreMin}
            options={SCORE_OPTIONS}
            onChange={handleSelectChange}
          />
          <div className="browse-filter-field">
            <span>Episodes</span>
            <div className="browse-range-pair">
              <input
                className="browse-range-input"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Min"
                aria-label="Minimum episodes"
                value={values.episodesMin}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    episodesMin: event.target.value.replace(/\D/g, ""),
                  }))
                }
                onBlur={() => handleEpisodeCommit("episodesMin")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleEpisodeCommit("episodesMin");
                  }
                }}
              />
              <input
                className="browse-range-input"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Max"
                aria-label="Maximum episodes"
                value={values.episodesMax}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    episodesMax: event.target.value.replace(/\D/g, ""),
                  }))
                }
                onBlur={() => handleEpisodeCommit("episodesMax")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleEpisodeCommit("episodesMax");
                  }
                }}
              />
            </div>
          </div>
          <div className="browse-filter-field">
            <span>Tags</span>
            <MultiSelect
              ariaLabel="Tags"
              searchable
              options={options.tags}
              included={splitListFilter(values.tag)}
              excluded={splitListFilter(values.tagExclude)}
              onChange={(included, excluded) =>
                handleMultiChange("tag", "tagExclude", included, excluded)
              }
            />
          </div>
          <SelectField
            label="Country of Origin"
            name="country"
            value={values.country}
            options={COUNTRY_OPTIONS}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Source"
            name="source"
            value={values.source}
            options={SOURCE_OPTIONS}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Your List"
            name="list"
            value={values.list}
            options={LIST_OPTIONS}
            onChange={handleSelectChange}
          />
        </div>
      )}
    </form>
  );
}
