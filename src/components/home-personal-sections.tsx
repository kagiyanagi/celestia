"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bookmark, Play } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { PublicUser } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";

export function HomePersonalSections({
  user: initialUser,
}: {
  user: PublicUser | null;
}) {
  const { user: authUser } = useAuth();
  const user = authUser || initialUser;
  const history = user?.historyEntries || [];
  const library = user?.libraryEntries || [];

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
                  {entry.anime.bannerImage || entry.anime.coverImage ? (
                    <Image
                      src={entry.anime.bannerImage || entry.anime.coverImage || ""}
                      alt=""
                      fill
                      sizes="360px"
                      className="poster-image"
                    />
                  ) : null}
                  <span className="continue-card-duration">{entry.durationLabel || `EP ${entry.episode}`}</span>
                  <span className="continue-card-progress">
                    <span style={{ width: `${entry.progressPercent}%` }} />
                  </span>
                </span>
                <span className="continue-card-copy">
                  <small>{getDisplayTitle(entry.anime.title)}</small>
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
            {watchlist.slice(0, 8).map((entry) => (
              <Link key={entry.id} href={`/anime/${entry.animeId}`} className="watchlist-card">
                <span className="watchlist-card-image">
                  {entry.anime.coverImage ? (
                    <Image src={entry.anime.coverImage} alt="" fill sizes="220px" className="poster-image" />
                  ) : null}
                </span>
                <span className="watchlist-card-meta">
                  <span>
                    {entry.anime.format === "TV" ? "TV Show" : entry.anime.format || "Anime"}
                  </span>
                  <span>{entry.anime.seasonYear || "Now"}</span>
                </span>
                <strong>{getDisplayTitle(entry.anime.title)}</strong>
                <span className="watchlist-card-status">
                  {entry.status === "watching" ? <Play size={14} /> : <Bookmark size={14} />}
                  {entry.status.replaceAll("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
