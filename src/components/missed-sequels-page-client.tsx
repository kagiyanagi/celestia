"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List as ListIcon } from "lucide-react";

import { BrowseResultsGrid, type BrowseView } from "@/components/browse-results-grid";
import { EMPTY_BROWSE_FILTERS } from "@/lib/browse-filters";
import type { AnimeSummary } from "@/types/anime";

type MissedSequelsPageClientProps = {
  initialItems: AnimeSummary[];
};

const VIEW_KEY = "mirucast:browse:view";

export function MissedSequelsPageClient({ initialItems }: MissedSequelsPageClientProps) {
  const [view, setView] = useState<BrowseView>("grid");

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

  return (
    <div className="page-shell compact-page">
      <section className="search-hero browse-hero">
        <span className="section-kicker">personalized list</span>
        <h1>Missed Sequels</h1>
        <p>New seasons, sequels, and side stories of anime you&apos;ve watched, which are missing from your watchlist.</p>
      </section>

      <section className="section-shell">
        <div className="section-heading">
          <span>{initialItems.length} {initialItems.length === 1 ? "title" : "titles"} found</span>
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
          </div>
        </div>

        {initialItems.length ? (
          <BrowseResultsGrid items={initialItems} filters={EMPTY_BROWSE_FILTERS} view={view} />
        ) : (
          <div className="empty-panel browse-empty">
            <p>You have caught up with all sequels of your completed series!</p>
          </div>
        )}
      </section>
    </div>
  );
}
