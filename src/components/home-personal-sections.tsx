"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { AnimeCard } from "@/components/anime-card";
import { useAuth } from "@/components/auth-provider";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import type { HistoryEntry, PublicUser } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";
import { getResumeEpisode } from "@/lib/resume";
import { buildWatchHref } from "@/lib/watch-href";

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

  // A fresh account (or guest) has nothing to surface yet — point them at the
  // tracking features instead of rendering an empty space.
  if (!history.length && !watchlist.length) {
    return (
      <HomeOnboarding
        isGuest={user.isGuest}
        hasAniList={Boolean(user.aniListProfile)}
      />
    );
  }

  const aniList = user.aniListProfile;

  return (
    <>
      {aniList ? (
        <Link className="home-personal-block home-stats" href="/profile">
          <span className="home-stats-item">
            <strong>{aniList.daysWatched.toFixed(1)}</strong>
            <small>Days Watched</small>
          </span>
          <span className="home-stats-item">
            <strong>{aniList.animeCompleted}</strong>
            <small>Anime Finished</small>
          </span>
          <span className="home-stats-item">
            <strong>{aniList.animeCount}</strong>
            <small>Total Anime</small>
          </span>
        </Link>
      ) : null}

      {history.length ? (
        <section className="home-personal-block">
          <div className="home-section-head">
            <h2>Continue Watching</h2>
            <Link href="/history" aria-label="View watch history">
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <div className="continue-watching-grid">
            {history.slice(0, 4).map((entry) => {
              const targetEpisode = getResumeEpisode(entry);
              const advance = targetEpisode !== entry.episode;
              const resumePercent =
                !advance &&
                entry.progressPercent > 0 &&
                entry.progressPercent < 100
                  ? entry.progressPercent
                  : 0;

              return (
                <Link
                  key={entry.id}
                  href={buildWatchHref({
                    animeId: entry.animeId,
                    episode: targetEpisode,
                  })}
                  className="continue-card"
                >
                  <span className="continue-card-thumb">
                    <EpisodeThumbnail
                      src={entry.episodeImage || null}
                      alt={entry.episodeTitle}
                      fallbackSrc={entry.anime.bannerImage || entry.anime.coverImage || null}
                    />
                    {entry.durationLabel ? (
                      <span className="continue-card-duration">{entry.durationLabel}</span>
                    ) : null}
                    {resumePercent ? (
                      <span className="continue-card-progress" aria-hidden>
                        <span style={{ width: `${resumePercent}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <span className="continue-card-copy">
                    <span className="continue-card-meta">
                      <span className="continue-card-ep-pill">
                        EP {targetEpisode}
                      </span>
                      <small>{getDisplayTitle(entry.anime.title, titleLanguage)}</small>
                    </span>
                    <strong>{advance ? "Up next" : entry.episodeTitle}</strong>
                  </span>
                </Link>
              );
            })}
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
            {watchlist.slice(0, 12).map((entry) => (
              <AnimeCard key={entry.id} anime={entry.anime} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function HomeOnboarding({
  isGuest,
  hasAniList,
}: {
  isGuest: boolean;
  hasAniList: boolean;
}) {
  return (
    <section className="home-personal-block home-onboarding">
      <div className="home-onboarding-copy">
        <span className="home-onboarding-kicker">
          <Sparkles size={14} aria-hidden />
          Make it yours
        </span>
        <h2>Track your anime with Celestia</h2>
        <p>
          {isGuest
            ? "Sign in to sync with AniList, keep your progress across devices, and pick up right where you left off."
            : "Connect your AniList account or import a MyAnimeList / AniList export to fill your home with what you're watching."}
        </p>
      </div>
      <div className="home-onboarding-actions">
        {isGuest ? (
          <Link className="home-onboarding-btn" href="/profile">
            Sign in
          </Link>
        ) : (
          <>
            {hasAniList ? null : (
              <a className="home-onboarding-btn" href="/api/anilist/connect">
                Connect AniList
              </a>
            )}
            <Link className="home-onboarding-btn ghost" href="/profile">
              Import a list
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
