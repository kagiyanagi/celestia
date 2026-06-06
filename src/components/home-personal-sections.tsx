"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { AnimeCard } from "@/components/anime-card";
import { useAuth } from "@/components/auth-provider";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import type { HistoryEntry, PublicUser } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";

/** Latest entry per anime — history is stored newest-first. */
function dedupeByAnime(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<number>();

  return entries.filter((entry) => {
    if (seen.has(entry.animeId)) {
      return false;
    }

    seen.add(entry.animeId);
    return true;
  });
}

export function HomePersonalSections({
  user: initialUser,
}: {
  user: PublicUser | null;
}) {
  const { user: authUser, refreshUser } = useAuth();
  const user = authUser || initialUser;
  const titleLanguage = user?.preferences.titleLanguage ?? "english";
  const history = dedupeByAnime(user?.historyEntries || []);
  const library = user?.libraryEntries || [];
  const refreshRef = useRef(refreshUser);

  useEffect(() => {
    refreshRef.current = refreshUser;
  }, [refreshUser]);

  // Keep Continue Watching fresh without a manual reload: refetch on mount
  // (back-navigation serves cached RSC payloads) and on tab refocus.
  useEffect(() => {
    void refreshRef.current();

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshRef.current();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  const watchlist = library.filter((entry) =>
    ["planning", "watching", "on_hold", "rewatching"].includes(entry.status),
  );

  if (!user) {
    return null;
  }

  return (
    <>
      {history.length ? (
        <section className="home-personal-block">
          <div className="home-section-head">
            <h2>Continue Watching</h2>
            <Link href="/history" aria-label="View watch history">
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <div className="continue-watching-grid">
            {history.slice(0, 4).map((entry) => (
              <Link key={entry.id} href={`/watch/${entry.animeId}?ep=${entry.episode}`} className="continue-card">
                <span className="continue-card-thumb">
                  <EpisodeThumbnail
                    src={entry.episodeImage || null}
                    alt={entry.episodeTitle}
                    fallbackSrc={entry.anime.bannerImage || entry.anime.coverImage || null}
                  />
                  {entry.durationLabel ? (
                    <span className="continue-card-duration">{entry.durationLabel}</span>
                  ) : null}
                </span>
                <span className="continue-card-copy">
                  <span className="continue-card-meta">
                    <span className="continue-card-ep-pill">
                      EP {entry.episode}
                    </span>
                    <small>{getDisplayTitle(entry.anime.title, titleLanguage)}</small>
                  </span>
                  <strong>{entry.episodeTitle}</strong>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {watchlist.length ? (
        <section className="home-personal-block">
          <div className="home-section-head">
            <h2>Watchlist</h2>
            <Link href="/watchlist">View all</Link>
          </div>
          <div className="watchlist-rail">
            {watchlist.slice(0, 6).map((entry) => (
              <AnimeCard key={entry.id} anime={entry.anime} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
