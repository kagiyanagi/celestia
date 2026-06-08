"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import { CustomSelect } from "@/components/custom-select";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
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
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
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
  // Real watch time is only available from AniList. We don't track per-episode
  // runtime locally, so for non-AniList profiles this stays unknown rather than
  // being faked from an assumed 24-min episode length.
  const daysWatched = profile?.daysWatched ?? null;

  async function updatePreference(next: Record<string, unknown>) {
    const response = await fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const payload = (await response.json()) as { user?: typeof user };
    if (response.ok && payload.user) {
      setUser(payload.user);
    }
  }

  async function importList(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportMessage("Importing your list…");

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/library/import", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        imported?: number;
        skipped?: number;
        error?: string;
      };

      if (!response.ok) {
        setImportMessage(payload.error || "Could not import that file.");
        return;
      }

      const skipped = payload.skipped
        ? ` (${payload.skipped} not matched on AniList)`
        : "";
      setImportMessage(`Imported ${payload.imported ?? 0} anime${skipped}.`);
    } catch {
      setImportMessage("Could not import that file.");
    } finally {
      setImporting(false);
    }
  }

  function signOut() {
    void fetch("/api/auth/logout", { method: "POST" }).then(() => {
      window.location.href = "/";
    });
  }

  function deleteAccount() {
    if (
      !window.confirm(
        "Permanently delete your account? Your library, history, and settings will be erased. This cannot be undone.",
      )
    ) {
      return;
    }
    void fetch("/api/me", { method: "DELETE" }).then((response) => {
      if (response.ok) {
        window.location.href = "/";
      }
    });
  }

  const recentHistory = historyEntries.slice(0, 12);

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
                <p>Hope you had a great day!</p>
              </div>
            </div>

            <div className="profile-stats-inline">
              <div>
                <strong>{daysWatched != null ? daysWatched.toFixed(1) : "—"}</strong>
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
          </div>
        </div>
      </section>

      <div className="page-shell profile-body">
        {connected ? <p className="success-message">AniList linked successfully.</p> : null}
        {error ? <p className="auth-error">{error}</p> : null}

        <section className="profile-section">
          <div className="home-section-head">
            <h2>History</h2>
            <Link href="/history">View all</Link>
          </div>
          {recentHistory.length ? (
            <div className="profile-history-rail">
              {recentHistory.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/watch/${entry.animeId}?ep=${entry.episode}`}
                  className="profile-history-card"
                >
                  <span className="profile-history-thumb">
                    <EpisodeThumbnail
                      src={entry.episodeImage || null}
                      alt={entry.episodeTitle}
                      fallbackSrc={entry.anime.bannerImage || entry.anime.coverImage || null}
                    />
                    {entry.durationLabel ? (
                      <span className="profile-history-duration">{entry.durationLabel}</span>
                    ) : null}
                    {entry.progressPercent > 0 ? (
                      <span className="profile-history-progress">
                        <span style={{ width: `${Math.min(100, entry.progressPercent)}%` }} />
                      </span>
                    ) : null}
                  </span>
                  <small className="profile-history-series">{getDisplayTitle(entry.anime.title, user.preferences.titleLanguage)}</small>
                  <strong className="profile-history-episode">{entry.episodeTitle}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <p className="profile-empty">Episodes you watch will show up here.</p>
          )}
        </section>

        <section className="profile-section profile-settings">
          <h2>Settings</h2>

          <div className="profile-setting-row">
            <div>
              <strong>Anime Title Language</strong>
              <span>How anime titles are displayed across the app.</span>
            </div>
            <CustomSelect
              value={user.preferences.titleLanguage}
              ariaLabel="Anime title language"
              options={[
                { value: "english", label: "English (Attack on Titan)" },
                { value: "romaji", label: "Romaji (Shingeki no Kyojin)" },
                { value: "native", label: "Native (進撃の巨人)" },
              ]}
              onChange={(value) => void updatePreference({ titleLanguage: value })}
            />
          </div>

          <div className="profile-setting-row">
            <div>
              <strong>Default Language</strong>
              <span>Set the default language for media playback.</span>
            </div>
            <CustomSelect
              value={user.preferences.defaultAudio}
              ariaLabel="Default playback language"
              dropup
              options={[
                { value: "sub", label: "Subtitles" },
                { value: "dub", label: "Dubbing" },
              ]}
              onChange={(value) => void updatePreference({ defaultAudio: value })}
            />
          </div>

          {(
            [
              ["hideAdultContent", "Hide Adult Content", "Hide content intended for mature audiences (18+)."],
              ["autoplayTrailers", "Autoplay Trailers", "Autoplay the trailer (muted) on anime detail pages."],
              ["pauseHistory", "Pause History", "When enabled, episode progress and watch data won't be saved."],
            ] as const
          ).map(([key, label, description]) => (
            <div className="profile-setting-row" key={key}>
              <div>
                <strong>{label}</strong>
                <span>{description}</span>
              </div>
              <button
                className={`switch ${user.preferences[key] ? "on" : ""}`}
                type="button"
                aria-label={label}
                onClick={() => void updatePreference({ [key]: !user.preferences[key] })}
              />
            </div>
          ))}

          <div className="profile-setting-row">
            <div>
              <strong>AniList</strong>
              <span>Sync your avatar, banner, list statuses, and activity.</span>
            </div>
            <button
              className="secondary-action"
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                window.location.href = "/api/anilist/connect";
              }}
            >
              {busy ? "Connecting..." : profile ? "Reconnect AniList" : "Connect AniList"}
            </button>
          </div>

          <div className="profile-setting-row">
            <div>
              <strong>Import List</strong>
              <span>
                {importMessage ||
                  "Upload a MyAnimeList or AniList XML export to add those titles to your library."}
              </span>
            </div>
            <label className="secondary-action" aria-disabled={importing}>
              {importing ? "Importing…" : "Upload XML"}
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                hidden
                disabled={importing}
                onChange={(event) => void importList(event)}
              />
            </label>
          </div>

          <div className="profile-danger-zone">
            <button className="text-action" type="button" onClick={signOut}>
              <LogOut size={18} />
              Sign out
            </button>
            <button className="text-action danger" type="button" onClick={deleteAccount}>
              <Trash2 size={18} />
              Delete account
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
