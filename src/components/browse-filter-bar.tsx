"use client";

import { ChevronDown, Filter, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useState,
  useTransition,
} from "react";

import {
  COUNTRY_OPTIONS,
  FORMAT_OPTIONS,
  getDefaultBrowseSort,
  getYearOptions,
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
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
};

function buildFilterUrl(basePath: string, filters: BrowseFilters): string {
  const query = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
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
  return (
    <label className="browse-filter-field">
      <span>{label}</span>
      <span className="browse-select-wrap">
        <select name={name} value={value} onChange={onChange}>
          {includeAny && <option value="">Any</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={18} aria-hidden />
      </span>
    </label>
  );
}

export function BrowseFilterBar({
  basePath,
  section,
  filters,
  options,
}: BrowseFilterBarProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();
  const defaultSort = getDefaultBrowseSort(section);
  const [values, setValues] = useState<BrowseFilters>({
    ...filters,
    sort: filters.sort || defaultSort,
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

  function handleSelectChange(event: ChangeEvent<HTMLSelectElement>) {
    const { name, value } = event.target;
    const filterName = name as keyof BrowseFilters;
    const nextValues: BrowseFilters = {
      ...values,
      [filterName]: value,
    };

    setValues(nextValues);
    applyFilters(nextValues);
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

      <button
        className="browse-filter-toggle"
        type="button"
        aria-label={isExpanded ? "Collapse filters" : "Expand filters"}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((currentValue) => !currentValue)}
      >
        <Filter size={22} aria-hidden />
      </button>

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
        </div>
      )}
    </form>
  );
}
