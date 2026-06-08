"use client";

import {
  ArrowDown01,
  ArrowDown10,
  Filter,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useState,
  useTransition,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { CustomSelect } from "@/components/custom-select";

import {
  COUNTRY_OPTIONS,
  EMPTY_BROWSE_FILTERS,
  FORMAT_OPTIONS,
  getDefaultBrowseSort,
  getYearOptions,
  LIST_OPTIONS,
  SEASON_OPTIONS,
  SORT_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
} from "@/lib/browse-filters";
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
  const defaultSort = getDefaultBrowseSort(section);
  const [values, setValues] = useState<BrowseFilters>({
    ...filters,
    sort: filters.sort || defaultSort,
    sortOrder: filters.sortOrder || "desc",
  });
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

  function handleSortOrderToggle() {
    const nextValues: BrowseFilters = {
      ...values,
      sortOrder: values.sortOrder === "asc" ? "desc" : "asc",
    };

    setValues(nextValues);
    applyFilters(nextValues);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters({
      ...values,
      q: values.q.trim(),
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
            value={values.q}
            onChange={handleSearchChange}
            placeholder="Search anime..."
            autoComplete="off"
          />
        </span>
      </label>

      <div className="browse-filter-actions" aria-label="Search controls">
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

      {isExpanded && (
        <div className="browse-filter-grid">
          <SelectField
            label="Genres"
            name="genre"
            value={values.genre}
            options={options.genres}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Format"
            name="format"
            value={values.format}
            options={FORMAT_OPTIONS}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Year"
            name="year"
            value={values.year}
            options={getYearOptions()}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Sort"
            name="sort"
            value={values.sort}
            options={SORT_OPTIONS}
            includeAny={false}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Season"
            name="season"
            value={values.season}
            options={SEASON_OPTIONS}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Airing Status"
            name="status"
            value={values.status}
            options={STATUS_OPTIONS}
            onChange={handleSelectChange}
          />
          <SelectField
            label="Tags"
            name="tag"
            value={values.tag}
            options={options.tags}
            onChange={handleSelectChange}
          />
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
