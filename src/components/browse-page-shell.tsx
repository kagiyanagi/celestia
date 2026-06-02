import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { AnimeCard } from "@/components/anime-card";
import type { AnimeSummary, BrowsePageInfo } from "@/types/anime";

type BrowsePageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: AnimeSummary[];
  pageInfo: BrowsePageInfo;
  basePath: string;
};

export function BrowsePageShell({
  eyebrow,
  title,
  description,
  items,
  pageInfo,
  basePath,
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

  function pageHref(page: number): string {
    return page <= 1 ? basePath : `${basePath}?page=${page}`;
  }

  return (
    <div className="page-shell compact-page">
      <section className="search-hero browse-hero">
        <span className="section-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <section className="section-shell">
        <div className="section-heading">
          <span>
            {pageInfo.total
              ? `${startItem}-${endItem} of ${pageInfo.total} titles`
              : `${items.length} titles`}
          </span>
          <h2>{title}</h2>
        </div>

        {items.length ? (
          <div className="anime-grid search-results">
            {items.map((anime) => (
              <AnimeCard anime={anime} key={anime.id} />
            ))}
          </div>
        ) : (
          <div className="empty-panel">No titles found for this page.</div>
        )}

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
      </section>
    </div>
  );
}
