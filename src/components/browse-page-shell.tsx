import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { BrowseFilterBar } from "@/components/browse-filter-bar";
import { BrowseResultsGrid } from "@/components/browse-results-grid";
import { buildBrowseHref } from "@/lib/browse-filters";
import type {
  AnimeSummary,
  BrowseFilterOptions,
  BrowseFilters,
  BrowsePageInfo,
  BrowseSectionKey,
} from "@/types/anime";

type BrowsePageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: AnimeSummary[];
  pageInfo: BrowsePageInfo;
  basePath: string;
  section: BrowseSectionKey;
  filters: BrowseFilters;
  filterOptions: BrowseFilterOptions;
  showSectionTitle?: boolean;
};

export function BrowsePageShell({
  eyebrow,
  title,
  description,
  items,
  pageInfo,
  basePath,
  section,
  filters,
  filterOptions,
  showSectionTitle = true,
}: BrowsePageShellProps) {
  const currentPage = Math.max(1, pageInfo.currentPage);
  const lastPage = pageInfo.lastPage ?? currentPage;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage =
    pageInfo.hasNextPage ||
    (pageInfo.lastPage !== null && currentPage < pageInfo.lastPage);
  const hasLastPage = pageInfo.lastPage !== null && currentPage < lastPage;
  const startItem = items.length ? (currentPage - 1) * pageInfo.perPage + 1 : 0;
  const endItem = startItem + items.length - 1;
  const filterKey = buildBrowseHref(basePath, filters);
  // "In your list" renders from the viewer's library — catalog counts and
  // pagination don't apply to it.
  const isLibraryView = filters.list === "in";

  function pageHref(page: number): string {
    return buildBrowseHref(basePath, filters, page);
  }

  return (
    <div className="page-shell compact-page">
      <section className="search-hero browse-hero">
        <span className="section-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <section className="section-shell">
        <BrowseFilterBar
          key={filterKey}
          basePath={basePath}
          section={section}
          filters={filters}
          options={filterOptions}
        />

        <div className="section-heading">
          {!isLibraryView ? (
            <span>
              {pageInfo.total
                ? `${startItem}-${endItem} of ${pageInfo.total} titles`
                : `${items.length} titles`}
            </span>
          ) : (
            <span>Your list</span>
          )}
          {showSectionTitle && <h2>{title}</h2>}
        </div>

        {items.length || isLibraryView ? (
          <BrowseResultsGrid items={items} filters={filters} />
        ) : (
          <div className="empty-panel">No titles found for this page.</div>
        )}

        {!isLibraryView ? (
        <nav className="pagination-nav" aria-label={`${title} pages`}>
          {hasPreviousPage ? (
            <Link
              className="pagination-button"
              href={pageHref(1)}
              aria-label="First page"
            >
              <ChevronsLeft size={18} aria-hidden />
            </Link>
          ) : (
            <span className="pagination-button disabled" aria-hidden>
              <ChevronsLeft size={18} />
            </span>
          )}

          {hasPreviousPage ? (
            <Link
              className="pagination-button"
              href={pageHref(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={18} aria-hidden />
            </Link>
          ) : (
            <span className="pagination-button disabled" aria-hidden>
              <ChevronLeft size={18} />
            </span>
          )}

          <span className="pagination-button current" aria-current="page">
            {currentPage}
          </span>

          {hasNextPage ? (
            <Link
              className="pagination-button"
              href={pageHref(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={18} aria-hidden />
            </Link>
          ) : (
            <span className="pagination-button disabled" aria-hidden>
              <ChevronRight size={18} />
            </span>
          )}

          {hasLastPage ? (
            <Link
              className="pagination-button"
              href={pageHref(lastPage)}
              aria-label="Last page"
            >
              <ChevronsRight size={18} aria-hidden />
            </Link>
          ) : (
            <span className="pagination-button disabled" aria-hidden>
              <ChevronsRight size={18} />
            </span>
          )}
        </nav>
        ) : null}
      </section>
    </div>
  );
}
