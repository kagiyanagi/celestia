"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { LogOut, Monitor, Pencil, Smartphone, Trash2 } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import { CustomSelect } from "@/components/custom-select";
import { EpisodeThumbnail } from "@/components/episode-thumbnail";
import type { HistoryEntry, LibraryEntry } from "@/types/account";
import { getDisplayTitle, formatRelativeSeconds, scoreLabel } from "@/lib/format";
import { ProfileStatBars } from "@/components/profile-stat-bars";
import { ProfileFavorites } from "@/components/profile-favorites";
import {
  computeLibraryStats,
  computeYearsInReview,
  type YearInReview,
} from "@/lib/profile-stats";
import { getResumeEpisode } from "@/lib/resume";

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
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [unmuting, setUnmuting] = useState<number | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [wrappedYear, setWrappedYear] = useState<number | null>(null);
  const [wrappedCopied, setWrappedCopied] = useState(false);
  // Captured after mount so relative "last active" times don't diverge between
  // the server render and the client (which would trip hydration).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
  }, []);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    pronouns: "",
    about: "",
  });
  const error = searchParams.get("error");
  const connected = searchParams.get("connected");
  const libraryEntries = user?.libraryEntries.length
    ? user.libraryEntries
    : library;
  const historyEntries = user?.historyEntries.length ? user.historyEntries : history;
  const stats = useMemo(
    () => computeLibraryStats(libraryEntries),
    [libraryEntries],
  );
  const years = useMemo(
    () => computeYearsInReview(libraryEntries),
    [libraryEntries],
  );

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

  function openEdit() {
    setForm({
      displayName: user?.displayName ?? "",
      username: user?.username ?? "",
      pronouns: user?.pronouns ?? "",
      about: user?.about ?? "",
    });
    setEditError("");
    setEditing(true);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setEditError("");
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        user?: typeof user;
        error?: string;
      };
      if (!response.ok || !payload.user) {
        setEditError(payload.error || "Could not save your profile.");
        return;
      }
      setUser(payload.user);
      setEditing(false);
    } catch {
      setEditError("Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeSessions(deviceId?: string) {
    setRevoking(deviceId ?? "others");
    try {
      const response = await fetch("/api/me/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deviceId ? { deviceId } : {}),
      });
      const payload = (await response.json()) as { user?: typeof user };
      if (response.ok && payload.user) {
        setUser(payload.user);
      }
    } finally {
      setRevoking(null);
    }
  }

  async function unmuteAnime(animeId: number) {
    setUnmuting(animeId);
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unmute", animeId }),
      });
      if (response.ok) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                mutedAnimeIds: (prev.mutedAnimeIds ?? []).filter(
                  (id) => id !== animeId,
                ),
              }
            : prev,
        );
      }
    } finally {
      setUnmuting(null);
    }
  }

  function copyWrapped(review: YearInReview) {
    if (!user) return;
    const title = review.topAnime
      ? getDisplayTitle(review.topAnime.title, user.preferences.titleLanguage)
      : null;
    const parts = [
      `My ${review.year} in anime on Celestia:`,
      `${review.completed} completed`,
      `${review.episodes} episodes`,
    ];
    if (review.meanScore != null) {
      parts.push(`mean ${scoreLabel(review.meanScore)}`);
    }
    if (review.topGenre) {
      parts.push(`top genre ${review.topGenre}`);
    }
    if (title) {
      parts.push(`favourite ${title}`);
    }
    void navigator.clipboard?.writeText(parts.join(" · ")).then(() => {
      setWrappedCopied(true);
      window.setTimeout(() => setWrappedCopied(false), 2000);
    });
  }

  async function clearWatchHistory() {
    if (
      !window.confirm(
        "Clear your entire watch history? This can't be undone.",
      )
    ) {
      return;
    }
    setClearingHistory(true);
    try {
      const response = await fetch("/api/history", { method: "DELETE" });
      const payload = (await response.json()) as { user?: typeof user };
      if (response.ok && payload.user) {
        setUser(payload.user);
      }
    } finally {
      setClearingHistory(false);
    }
  }

  async function syncAniList() {
    setSyncing(true);
    try {
      const response = await fetch("/api/anilist/sync", {
        method: "POST",
        cache: "no-store",
      });
      const payload = (await response.json()) as { user?: typeof user };
      if (response.ok && payload.user) {
        setUser(payload.user);
      }
    } finally {
      setSyncing(false);
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
  const continueWatching = (() => {
    const seen = new Set<number>();
    const items: { entry: HistoryEntry; resumeEp: number }[] = [];
    for (const entry of historyEntries) {
      if (seen.has(entry.animeId)) continue;
      seen.add(entry.animeId);
      const maxEpisode = entry.anime.airingCount ?? entry.anime.episodes ?? null;
      const finishedShow =
        entry.progressPercent >= 90 &&
        maxEpisode != null &&
        entry.episode >= maxEpisode;
      if (finishedShow) continue;
      items.push({ entry, resumeEp: getResumeEpisode(entry) });
      if (items.length >= 12) break;
    }
    return items;
  })();
  const libraryByAnimeId = new Map(
    libraryEntries.map((entry) => [entry.animeId, entry.anime]),
  );
  const mutedShows = (user.mutedAnimeIds ?? []).map((id) => ({
    id,
    anime: libraryByAnimeId.get(id) ?? null,
  }));
  const activeReview =
    years.find((review) => review.year === wrappedYear) ?? years[0] ?? null;

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
              <div className="profile-identity">
                <h1>{user.displayName}</h1>
                <p className="profile-handle">
                  <span>@{user.username}</span>
                  {user.pronouns ? (
                    <span className="profile-pronouns">{user.pronouns}</span>
                  ) : null}
                </p>
                {user.about ? (
                  <p className="profile-bio">{user.about}</p>
                ) : (
                  <p className="profile-bio profile-bio-empty">
                    Hope you had a great day!
                  </p>
                )}
                <button
                  className="secondary-action profile-edit-trigger"
                  type="button"
                  onClick={openEdit}
                >
                  <Pencil size={15} />
                  Edit profile
                </button>
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

        {editing ? (
          <section className="profile-section profile-edit-card">
            <h2>Edit profile</h2>
            <form
              className="settings-form-column profile-edit-form"
              onSubmit={(event) => void saveProfile(event)}
            >
              <label>
                Display name
                <input
                  value={form.displayName}
                  maxLength={50}
                  required
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, displayName: event.target.value }))
                  }
                />
              </label>
              <label>
                Username
                <input
                  value={form.username}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, username: event.target.value }))
                  }
                />
                <small>
                  3–30 characters: letters, numbers, underscores, or hyphens.
                </small>
              </label>
              <label>
                Pronouns
                <input
                  value={form.pronouns}
                  maxLength={40}
                  placeholder="she/her, he/him, they/them…"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, pronouns: event.target.value }))
                  }
                />
              </label>
              <label>
                About
                <textarea
                  value={form.about}
                  rows={4}
                  maxLength={500}
                  placeholder="Tell others about your taste in anime…"
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, about: event.target.value }))
                  }
                />
              </label>
              {editError ? <p className="auth-error">{editError}</p> : null}
              <div className="profile-edit-actions">
                <button type="submit" className="secondary-action" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {continueWatching.length ? (
          <section className="profile-section">
            <div className="home-section-head">
              <h2>Continue watching</h2>
            </div>
            <div className="profile-history-rail">
              {continueWatching.map(({ entry, resumeEp }) => (
                <Link
                  key={entry.animeId}
                  href={`/watch/${entry.animeId}?ep=${resumeEp}`}
                  className="profile-history-card"
                >
                  <span className="profile-history-thumb">
                    <EpisodeThumbnail
                      src={entry.episodeImage || null}
                      alt={entry.episodeTitle}
                      fallbackSrc={
                        entry.anime.bannerImage || entry.anime.coverImage || null
                      }
                    />
                    {resumeEp === entry.episode && entry.progressPercent > 0 ? (
                      <span className="profile-history-progress">
                        <span
                          style={{
                            width: `${Math.min(100, entry.progressPercent)}%`,
                          }}
                        />
                      </span>
                    ) : null}
                  </span>
                  <small className="profile-history-series">
                    {getDisplayTitle(
                      entry.anime.title,
                      user.preferences.titleLanguage,
                    )}
                  </small>
                  <strong className="profile-history-episode">
                    Episode {resumeEp}
                  </strong>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

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

        {stats.total > 0 ? (
          <section className="profile-section">
            <h2>Stats</h2>
            <div className="profile-stats-summary">
              <div>
                <strong>{stats.episodesWatched}</strong>
                <span>Episodes watched</span>
              </div>
              {stats.meanScore != null ? (
                <div>
                  <strong>{scoreLabel(stats.meanScore)}</strong>
                  <span>Mean score</span>
                </div>
              ) : null}
              <div>
                <strong>{stats.scoredCount}</strong>
                <span>Rated</span>
              </div>
            </div>
            <div className="profile-stats-grid">
              {stats.statusBreakdown.length ? (
                <div className="profile-stats-card">
                  <h3>Status</h3>
                  <ProfileStatBars
                    items={stats.statusBreakdown.map((item) => ({
                      label: item.label,
                      count: item.count,
                    }))}
                  />
                </div>
              ) : null}
              {stats.topGenres.length ? (
                <div className="profile-stats-card">
                  <h3>Top genres</h3>
                  <ProfileStatBars items={stats.topGenres} />
                </div>
              ) : null}
              {stats.formatBreakdown.length ? (
                <div className="profile-stats-card">
                  <h3>Formats</h3>
                  <ProfileStatBars items={stats.formatBreakdown} />
                </div>
              ) : null}
              {stats.decadeBreakdown.length ? (
                <div className="profile-stats-card">
                  <h3>By decade</h3>
                  <ProfileStatBars items={stats.decadeBreakdown} />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <ProfileFavorites favorites={user.favorites ?? []} />

        {activeReview ? (
          <section className="profile-section">
            <div className="home-section-head">
              <h2>Year in review</h2>
              {years.length > 1 ? (
                <div className="profile-wrapped-years">
                  {years.map((review) => (
                    <button
                      key={review.year}
                      type="button"
                      className={`profile-wrapped-year ${
                        review.year === activeReview.year ? "active" : ""
                      }`}
                      onClick={() => setWrappedYear(review.year)}
                    >
                      {review.year}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="profile-wrapped-card">
              <div className="profile-wrapped-head">
                <span className="profile-wrapped-year-label">
                  {activeReview.year}
                </span>
                <p className="profile-wrapped-headline">
                  <strong>{activeReview.completed}</strong> anime completed
                </p>
              </div>
              <div className="profile-wrapped-figures">
                <div>
                  <strong>{activeReview.episodes}</strong>
                  <span>Episodes</span>
                </div>
                {activeReview.meanScore != null ? (
                  <div>
                    <strong>{scoreLabel(activeReview.meanScore)}</strong>
                    <span>Mean score</span>
                  </div>
                ) : null}
                {activeReview.topGenre ? (
                  <div>
                    <strong>{activeReview.topGenre}</strong>
                    <span>Top genre</span>
                  </div>
                ) : null}
              </div>
              {activeReview.topAnime ? (
                <Link
                  href={`/anime/${activeReview.topAnime.id}`}
                  className="profile-wrapped-top"
                >
                  <span className="profile-wrapped-top-poster">
                    {activeReview.topAnime.coverImage ? (
                      <Image
                        src={activeReview.topAnime.coverImage}
                        alt=""
                        fill
                        sizes="56px"
                        className="poster-image"
                      />
                    ) : null}
                  </span>
                  <span className="profile-wrapped-top-meta">
                    <span>Favourite of the year</span>
                    <strong>
                      {getDisplayTitle(
                        activeReview.topAnime.title,
                        user.preferences.titleLanguage,
                      )}
                    </strong>
                  </span>
                </Link>
              ) : null}
              <button
                type="button"
                className="secondary-action"
                onClick={() => copyWrapped(activeReview)}
              >
                {wrappedCopied ? "Copied!" : "Copy summary"}
              </button>
            </div>
          </section>
        ) : null}

        {profile?.activity?.length ? (
          <section className="profile-section">
            <div className="home-section-head">
              <h2>Recent activity</h2>
              {profile.siteUrl ? (
                <a href={profile.siteUrl} target="_blank" rel="noreferrer">
                  View on AniList
                </a>
              ) : null}
            </div>
            <ul className="profile-activity-list">
              {profile.activity.slice(0, 10).map((item) => {
                const when =
                  now != null
                    ? formatRelativeSeconds(
                        (Date.parse(item.createdAt) - now) / 1000,
                      )
                    : null;
                return (
                  <li key={item.id} className="profile-activity-item">
                    <Link
                      href={`/anime/${item.animeId}`}
                      className="profile-activity-link"
                    >
                      <span className="profile-activity-poster">
                        {item.coverImage ? (
                          <Image
                            src={item.coverImage}
                            alt=""
                            fill
                            sizes="44px"
                            className="poster-image"
                          />
                        ) : null}
                      </span>
                      <span className="profile-activity-meta">
                        <strong>{item.animeTitle}</strong>
                        <span>
                          {item.progress > 0
                            ? `Watched episode ${item.progress}`
                            : "Updated"}
                          {when ? ` · ${when}` : ""}
                        </span>
                      </span>
                      {item.source === "anilist" ? (
                        <span className="profile-activity-source">AniList</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="profile-section profile-settings">
          <h2>Settings</h2>

          <h3 className="profile-settings-subhead">Preferences</h3>

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

          <h3 className="profile-settings-subhead">Privacy</h3>

          <div className="profile-setting-row">
            <div>
              <strong>Public Profile</strong>
              <span>
                {user.preferences.publicProfile
                  ? "Anyone with the link can view your profile."
                  : "Let anyone view your stats at a shareable link."}
              </span>
            </div>
            <div className="profile-setting-actions">
              {user.preferences.publicProfile ? (
                <a
                  className="secondary-action"
                  href={`/u/${user.username}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              ) : null}
              <button
                className={`switch ${user.preferences.publicProfile ? "on" : ""}`}
                type="button"
                aria-label="Public Profile"
                onClick={() =>
                  void updatePreference({
                    publicProfile: !user.preferences.publicProfile,
                  })
                }
              />
            </div>
          </div>

          <h3 className="profile-settings-subhead">Notifications</h3>

          {(
            [
              ["notifyEpisodes", "New Episode Alerts", "Notify when a new subbed episode airs for a tracked show."],
              ["notifyDubs", "New Dub Alerts", "Notify when a new English dub episode drops."],
              ["notifyUpcoming", "Airing Soon Reminders", "Remind you shortly before a tracked show's next episode airs."],
            ] as const
          ).map(([key, label, description]) => {
            // Older records lack these fields; treat undefined as enabled.
            const enabled = user.preferences[key] !== false;
            return (
              <div className="profile-setting-row" key={key}>
                <div>
                  <strong>{label}</strong>
                  <span>{description}</span>
                </div>
                <button
                  className={`switch ${enabled ? "on" : ""}`}
                  type="button"
                  aria-label={label}
                  onClick={() => void updatePreference({ [key]: !enabled })}
                />
              </div>
            );
          })}

          {mutedShows.length ? (
            <div className="profile-muted">
              <div className="profile-muted-head">
                <strong>Muted shows</strong>
                <span>These shows won&apos;t produce any notifications.</span>
              </div>
              <ul className="profile-muted-list">
                {mutedShows.map(({ id, anime }) => (
                  <li key={id} className="profile-muted-row">
                    <span className="profile-muted-poster">
                      {anime?.coverImage ? (
                        <Image
                          src={anime.coverImage}
                          alt=""
                          fill
                          sizes="40px"
                          className="poster-image"
                        />
                      ) : null}
                    </span>
                    <span className="profile-muted-title">
                      {anime
                        ? getDisplayTitle(
                            anime.title,
                            user.preferences.titleLanguage,
                          )
                        : `Anime #${id}`}
                    </span>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={unmuting !== null}
                      onClick={() => void unmuteAnime(id)}
                    >
                      {unmuting === id ? "Unmuting…" : "Unmute"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <h3 className="profile-settings-subhead">Connections</h3>

          <div className="profile-setting-row">
            <div>
              <strong>AniList</strong>
              <span>Sync your avatar, banner, list statuses, and activity.</span>
            </div>
            <div className="profile-setting-actions">
              {profile ? (
                <button
                  className="secondary-action"
                  type="button"
                  disabled={syncing}
                  onClick={() => void syncAniList()}
                >
                  {syncing ? "Syncing…" : "Sync now"}
                </button>
              ) : null}
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

          <div className="profile-setting-row">
            <div>
              <strong>Export List</strong>
              <span>
                Download your library as a MyAnimeList-compatible XML file.
              </span>
            </div>
            <a className="secondary-action" href="/api/library/export">
              Download XML
            </a>
          </div>

          <h3 className="profile-settings-subhead">Account</h3>

          {user.devices.length ? (
            <div className="profile-sessions">
              <div className="profile-sessions-head">
                <div>
                  <strong>Active sessions</strong>
                  <span>Devices currently signed in to your account.</span>
                </div>
                {user.devices.some((device) => !device.current) ? (
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={revoking !== null}
                    onClick={() => void revokeSessions()}
                  >
                    {revoking === "others"
                      ? "Signing out…"
                      : "Sign out other devices"}
                  </button>
                ) : null}
              </div>
              <ul className="profile-session-list">
                {user.devices.map((device) => {
                  const Icon = /android|ios/i.test(device.platform)
                    ? Smartphone
                    : Monitor;
                  const lastActive =
                    now != null
                      ? formatRelativeSeconds(
                          (Date.parse(device.lastActiveAt) - now) / 1000,
                        )
                      : null;
                  return (
                    <li key={device.id} className="profile-session-row">
                      <span className="profile-session-icon">
                        <Icon size={20} />
                      </span>
                      <div className="profile-session-meta">
                        <strong>
                          {device.label}
                          {device.current ? (
                            <span className="profile-session-current">
                              This device
                            </span>
                          ) : null}
                        </strong>
                        <span>
                          {device.locationLabel}
                          {lastActive ? ` · Active ${lastActive}` : ""}
                        </span>
                      </div>
                      {device.current ? null : (
                        <button
                          className="text-action"
                          type="button"
                          disabled={revoking !== null}
                          onClick={() => void revokeSessions(device.id)}
                        >
                          {revoking === device.id ? "Signing out…" : "Sign out"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="profile-danger-zone">
            <button className="text-action" type="button" onClick={signOut}>
              <LogOut size={18} />
              Sign out
            </button>
            <button
              className="text-action"
              type="button"
              disabled={clearingHistory}
              onClick={() => void clearWatchHistory()}
            >
              <Trash2 size={18} />
              {clearingHistory ? "Clearing…" : "Clear history"}
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
