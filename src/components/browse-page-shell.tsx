"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  List as ListIcon,
  Loader2,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { BrowseFilterBar } from "@/components/browse-filter-bar";
import { BrowseResultsGrid, type BrowseView } from "@/components/browse-results-grid";
import { useAuth } from "@/components/auth-provider";
import {
  buildBrowseHref,
  getListFilterLabel,
  isLibraryListFilter,
  joinListFilter,
  splitListFilter,
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

const VIEW_KEY = "celestia:browse:view";

// Curated quick-pick genres; only those AniList actually offers are shown.
const PILL_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Supernatural",
  "Mystery",
  "Sports",
  "Horror",
];

function browseApiParams(
  section: BrowseSectionKey,
  filters: BrowseFilters,
  page: number,
): string {
  const params = new URLSearchParams({ section, page: String(page) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value && key !== "dubbed") {
      params.set(key, value);
    }
  });
  return params.toString();
}

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
  const router = useRouter();
  const { user } = useAuth();
  const includeAdult = Boolean(
    user && !user.preferences.hideAdultContent && !filters.list,
  );
  const browseKey = buildBrowseHref(basePath, filters, pageInfo.currentPage);

  const [view, setView] = useState<BrowseView>("grid");
  const [personalized, setPersonalized] = useState<{
    key: string;
    collection: BrowseCollection;
  } | null>(null);
  const [extra, setExtra] = useState<{
    key: string;
    items: AnimeSummary[];
    through: number;
    hasNext: boolean;
    loading: boolean;
  } | null>(null);

  // Restore the saved layout after mount (deferred; first render = server grid).
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (window.localStorage.getItem(VIEW_KEY) === "list") {
          setView("list");
        }
      } catch {
        // Non-fatal.
      }
    });
  }, []);

  function chooseView(next: BrowseView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Non-fatal.
    }
  }

  // Adult-inclusive results are personalized per viewer, so they can't be part
  // of the cached server render — refetch them client-side.
  useEffect(() => {
    if (!includeAdult) {
      return;
    }

    const controller = new AbortController();
    fetch(`/api/browse?${browseApiParams(section, filters, pageInfo.currentPage)}`, {
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

  // Appended (infinite-scroll) pages are keyed to browseKey, so a stale `extra`
  // from a previous query is simply ignored below rather than reset in an effect.
  const baseCollection =
    includeAdult && personalized?.key === browseKey
      ? personalized.collection
      : { items, pageInfo };
  const adultPending = includeAdult && personalized?.key !== browseKey;

  const activePageInfo = baseCollection.pageInfo;
  const currentPage = Math.max(1, activePageInfo.currentPage);
  const lastPage = activePageInfo.lastPage ?? currentPage;
  const isLibraryView = isLibraryListFilter(filters.list);

  const appended = extra?.key === browseKey ? extra.items : [];
  const displayItems = [...baseCollection.items, ...appended];

  const loadedThrough = extra?.key === browseKey ? extra.through : currentPage;
  const hasMore =
    !isLibraryView &&
    (extra?.key === browseKey
      ? extra.hasNext
      : activePageInfo.hasNextPage ||
        (activePageInfo.lastPage !== null && currentPage < activePageInfo.lastPage));
  const loadingMore = extra?.key === browseKey ? extra.loading : false;

  const loadMore = useCallback(async () => {
    if (isLibraryView || loadingMore || !hasMore) {
      return;
    }
    const nextPage = loadedThrough + 1;
    setExtra((current) => ({
      key: browseKey,
      items: current?.key === browseKey ? current.items : [],
      through: current?.key === browseKey ? current.through : currentPage,
      hasNext: current?.key === browseKey ? current.hasNext : true,
      loading: true,
    }));

    try {
      const response = await fetch(
        `/api/browse?${browseApiParams(section, filters, nextPage)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        collection?: BrowseCollection;
      };
      const collection = payload.collection;
      setExtra((current) => {
        const prevItems = current?.key === browseKey ? current.items : [];
        return {
          key: browseKey,
          items: [...prevItems, ...(collection?.items || [])],
          through: nextPage,
          hasNext: Boolean(collection?.pageInfo?.hasNextPage),
          loading: false,
        };
      });
    } catch {
      setExtra((current) =>
        current ? { ...current, loading: false } : current,
      );
    }
  }, [
    browseKey,
    currentPage,
    filters,
    hasMore,
    isLibraryView,
    loadedThrough,
    loadingMore,
    section,
  ]);

  // Auto-load the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const startItem = displayItems.length
    ? (currentPage - 1) * activePageInfo.perPage + 1
    : 0;
  const endItem = startItem + displayItems.length - 1;
  const filterKey = buildBrowseHref(basePath, filters);
  const listLabel = getListFilterLabel(filters.list) || "Your list";
  const hasActiveQuery = filterKey !== basePath;

  function pageHref(page: number): string {
    return buildBrowseHref(basePath, filters, page);
  }

  function handleJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = new FormData(event.currentTarget).get("page");
    const target = Math.min(lastPage, Math.max(1, Number(input) || 1));
    router.push(pageHref(target));
  }

  const pillGenres = PILL_GENRES.filter((genre) =>
    filterOptions.genres.some((option) => option.value === genre),
  );
  const activeGenres = splitListFilter(filters.genre);

  function genrePillHref(genre: string): string {
    const next = activeGenres.includes(genre)
      ? activeGenres.filter((item) => item !== genre)
      : [...activeGenres, genre];
    return buildBrowseHref(basePath, { ...filters, genre: joinListFilter(next) }, 1);
  }

  const hasPreviousPage = currentPage > 1;
  const hasNextPage =
    activePageInfo.hasNextPage ||
    (activePageInfo.lastPage !== null && currentPage < activePageInfo.lastPage);
  const hasLastPage = activePageInfo.lastPage !== null && currentPage < lastPage;

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

        {pillGenres.length ? (
          <div className="browse-genre-pills" aria-label="Quick genre filters">
            {pillGenres.map((genre) => {
              const active = activeGenres.includes(genre);
              return (
                <Link
                  key={genre}
                  href={genrePillHref(genre)}
                  className={`browse-genre-pill${active ? " active" : ""}`}
                  aria-pressed={active}
                >
                  {genre}
                </Link>
              );
            })}
          </div>
        ) : null}

        <div className="section-heading">
          {!isLibraryView ? (
            <span>
              {activePageInfo.total
                ? `${startItem}-${endItem} of ${activePageInfo.total} titles`
                : `${displayItems.length} titles`}
            </span>
          ) : (
            <span>{listLabel}</span>
          )}
          <div className="browse-heading-actions">
            <span className="browse-view-toggle" role="group" aria-label="Result layout">
              <button
                type="button"
                className={view === "grid" ? "active" : ""}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => chooseView("grid")}
              >
                <LayoutGrid size={16} aria-hidden />
              </button>
              <button
                type="button"
                className={view === "list" ? "active" : ""}
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => chooseView("list")}
              >
                <ListIcon size={16} aria-hidden />
              </button>
            </span>
            {showSectionTitle && <h2>{title}</h2>}
          </div>
        </div>

        {adultPending ? (
          <div className="empty-panel">Loading your results...</div>
        ) : displayItems.length || isLibraryView ? (
          <BrowseResultsGrid items={displayItems} filters={filters} view={view} />
        ) : (
          <div className="empty-panel browse-empty">
            <p>No titles match these filters.</p>
            {hasActiveQuery ? (
              <Link className="primary-action" href={basePath}>
                Clear filters
              </Link>
            ) : null}
          </div>
        )}

        {!isLibraryView && hasMore ? (
          <div className="browse-load-more" ref={sentinelRef}>
            <button
              type="button"
              className="secondary-action"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 size={16} className="spin" aria-hidden /> Loading...
                </>
              ) : (
                "Load more"
              )}
            </button>
          </div>
        ) : null}

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

            {activePageInfo.lastPage && activePageInfo.lastPage > 1 ? (
              <form className="pagination-jump" onSubmit={handleJump}>
                <input
                  type="number"
                  name="page"
                  min={1}
                  max={lastPage}
                  defaultValue={currentPage}
                  aria-label={`Jump to page (1-${lastPage})`}
                />
                <span>/ {lastPage}</span>
              </form>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  );
}
