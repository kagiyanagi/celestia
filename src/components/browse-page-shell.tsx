"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useEffect, useState } from "react";

import { BrowseFilterBar } from "@/components/browse-filter-bar";
import { BrowseResultsGrid } from "@/components/browse-results-grid";
import { useAuth } from "@/components/auth-provider";
import {
  buildBrowseHref,
  getListFilterLabel,
  isLibraryListFilter,
} from "@/lib/browse-filters";
import type {
  AnimeSummary,
  BrowseCollection,
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
  const { user } = useAuth();
  const includeAdult = Boolean(
    user && !user.preferences.hideAdultContent && !filters.list,
  );
  const browseKey = buildBrowseHref(basePath, filters, pageInfo.currentPage);
  const [personalized, setPersonalized] = useState<{
    key: string;
    collection: BrowseCollection;
  } | null>(null);

  useEffect(() => {
    if (!includeAdult) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      section,
      page: String(pageInfo.currentPage),
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    fetch(`/api/browse?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { collection?: BrowseCollection } | null) => {
        if (payload?.collection) {
          setPersonalized({ key: browseKey, collection: payload.collection });
        }
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("Personalized browse collection failed", error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [browseKey, filters, includeAdult, pageInfo.currentPage, section]);

  const collection =
    includeAdult && personalized?.key === browseKey
      ? personalized.collection
      : { items, pageInfo };
  const activeItems = collection.items;
  const activePageInfo = collection.pageInfo;
  const currentPage = Math.max(1, activePageInfo.currentPage);
  const lastPage = activePageInfo.lastPage ?? currentPage;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage =
    activePageInfo.hasNextPage ||
    (activePageInfo.lastPage !== null && currentPage < activePageInfo.lastPage);
  const hasLastPage = activePageInfo.lastPage !== null && currentPage < lastPage;
  const startItem = activeItems.length
    ? (currentPage - 1) * activePageInfo.perPage + 1
    : 0;
  const endItem = startItem + activeItems.length - 1;
  const filterKey = buildBrowseHref(basePath, filters);
  // Library filters render from the viewer's list — catalog counts and
  // pagination don't apply to them.
  const isLibraryView = isLibraryListFilter(filters.list);
  const listLabel = getListFilterLabel(filters.list) || "Your list";

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
              {activePageInfo.total
                ? `${startItem}-${endItem} of ${activePageInfo.total} titles`
                : `${activeItems.length} titles`}
            </span>
          ) : (
            <span>{listLabel}</span>
          )}
          {showSectionTitle && <h2>{title}</h2>}
        </div>

        {activeItems.length || isLibraryView ? (
          <BrowseResultsGrid items={activeItems} filters={filters} />
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
