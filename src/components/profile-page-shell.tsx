"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import type { HistoryEntry, LibraryEntry } from "@/types/account";
import { getDisplayTitle } from "@/lib/format";

export function ProfilePageShell({
  library,
  history,
}: {
  library: LibraryEntry[];
  history: HistoryEntry[];
}) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const error = searchParams.get("error");
  const connected = searchParams.get("connected");
  const libraryEntries = user?.libraryEntries.length
    ? user.libraryEntries
    : library;
  const historyEntries = user?.historyEntries.length ? user.historyEntries : history;
  if (!user) {
    return (
      <div className="page-shell profile-auth-shell">
        <div className="profile-auth-copy">
          <h1>Account</h1>
          <p>Create an account to sync watch progress, list saves, watch history, and AniList activity.</p>
        </div>
        <AuthPanel />
      </div>
    );
  }

  const profile = user.aniListProfile;
  const finishedCount = libraryEntries.filter(
    (entry) => entry.status === "completed",
  ).length;
  const totalEpisodes = libraryEntries.reduce(
    (total, entry) => total + entry.progress,
    0,
  );
  const daysWatched = (totalEpisodes * 24) / (60 * 24);

  return (
    <div className="profile-page">
      <section className="profile-hero">
        {user.banner ? (
          <Image src={user.banner} alt="" fill priority sizes="100vw" className="profile-hero-banner" />
        ) : null}
        <div className="profile-hero-scrim" />
        <div className="page-shell profile-hero-content">
          <div className="profile-header-row">
            <div className="profile-header-copy">
              <span className="profile-avatar">
                {user.avatar ? (
                  <Image src={user.avatar} alt={user.displayName} fill sizes="120px" className="poster-image" />
                ) : (
                  <span className="avatar-fallback">{user.displayName.slice(0, 1)}</span>
                )}
              </span>
              <div>
                <h1>{user.displayName}</h1>
                <p>@{user.username}</p>
                <small>
                  Member since{" "}
                  {new Intl.DateTimeFormat("en", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(user.joinedAt))}
                </small>
              </div>
            </div>
          </div>

          <div className="profile-overview-grid">
            <div className="profile-stats-card">
              <div>
                <strong>{(profile?.daysWatched || daysWatched).toFixed(1)}</strong>
                <span>Days Watched</span>
              </div>
              <div>
                <strong>{profile?.animeCompleted || finishedCount}</strong>
                <span>Anime Finished</span>
              </div>
              <div>
                <strong>{profile?.animeCount || libraryEntries.length}</strong>
                <span>Total Anime</span>
              </div>
            </div>

            <div className="profile-activity-card">
              <div className="profile-activity-head">
                <h2>Recent Activity</h2>
                {!profile ? (
                  <button
                    className="primary-action"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      window.location.href = "/api/anilist/connect";
                    }}
                  >
                    {busy ? "Connecting..." : "Link AniList"}
                  </button>
                ) : (
                  <a href={profile.siteUrl || "https://anilist.co"} target="_blank" rel="noreferrer">
                    View AniList
                  </a>
                )}
              </div>
              {connected ? <p className="success-message">AniList linked successfully.</p> : null}
              {error ? <p className="auth-error">{error}</p> : null}
              <div className="profile-activity-list">
                {(profile?.activity.length ? profile.activity : historyEntries.slice(0, 5).map((entry) => ({
                  id: entry.id,
                  animeId: entry.animeId,
                  coverImage: entry.anime.coverImage || null,
                  animeTitle: getDisplayTitle(entry.anime.title),
                  progress: entry.episode,
                  createdAt: entry.watchedAt,
                  source: "local" as const,
                }))).map((activity) => (
                  <div className="profile-activity-item" key={activity.id}>
                    <span className="profile-activity-cover">
                      {activity.coverImage ? (
                        <Image src={activity.coverImage} alt="" fill sizes="80px" className="poster-image" />
                      ) : (
                        <span className="avatar-fallback">EP</span>
                      )}
                    </span>
                    <div>
                      <small>
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(activity.createdAt))}
                      </small>
                      <strong>Watched ep {activity.progress} of {activity.animeTitle}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="profile-content-grid">
            <section>
              <div className="home-section-head">
                <h2>Anime List</h2>
                <Link href="/watchlist">view more</Link>
              </div>
              <div className="profile-anime-grid">
                {libraryEntries.slice(0, 5).map((entry) => (
                  <Link key={entry.id} href={`/anime/${entry.animeId}`} className="profile-anime-grid-card">
                    {entry.anime.coverImage ? (
                      <Image src={entry.anime.coverImage} alt="" fill sizes="220px" className="poster-image" />
                    ) : (
                      <span className="avatar-fallback">{getDisplayTitle(entry.anime.title).slice(0, 1)}</span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className="profile-footer-actions">
            <Link href="/settings" className="text-action">
              Settings
            </Link>
            <button
              className="text-action danger"
              type="button"
              onClick={() => {
                void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  window.location.href = "/";
                });
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
