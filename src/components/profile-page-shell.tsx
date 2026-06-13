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
import { Calendar, ExternalLink, LogOut, Monitor, Pencil, Smartphone, Trash2 } from "lucide-react";
import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import { CustomSelect } from "@/components/custom-select";
import { DropdownMultiSelect } from "@/components/dropdown-multi-select";
import { HomePersonalSections } from "@/components/home-personal-sections";
import type { LibraryEntry } from "@/types/account";
import { getDisplayTitle, formatRelativeSeconds } from "@/lib/format";
import { ProfileStatsSection } from "@/components/profile-stats-section";
import { ProfileFavorites } from "@/components/profile-favorites";
import {
  computeLibraryStats,
} from "@/lib/profile-stats";

function formatJoinedDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return "";
  }
}

export function ProfilePageShell({
  library,
}: {
  library: LibraryEntry[];
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
  const stats = useMemo(
    () => computeLibraryStats(libraryEntries),
    [libraryEntries],
  );

  // A guest IS a user (auto-created session), so this must also catch guests -
  // otherwise the AuthPanel (which hosts the AniList connect + login/signup) is
  // unreachable and every "Sign in" CTA just loops back to the guest profile.
  if (!user || user.isGuest) {
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

  const libraryByAnimeId = new Map(
    libraryEntries.map((entry) => [entry.animeId, entry.anime]),
  );
  const mutedShows = (user.mutedAnimeIds ?? []).map((id) => ({
    id,
    anime: libraryByAnimeId.get(id) ?? null,
  }));

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
                <div className="profile-metadata">
                  <span className="metadata-badge">
                    <Calendar size={13} />
                    Joined {formatJoinedDate(user.joinedAt)}
                  </span>
                  {user.aniListProfile?.siteUrl ? (
                    <a
                      href={user.aniListProfile.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="metadata-badge interactive"
                    >
                      <ExternalLink size={13} />
                      AniList: {user.aniListProfile.name}
                    </a>
                  ) : null}
                </div>
                {user.about ? (
                  <p className="profile-bio">{user.about}</p>
                ) : user.aniListProfile?.about ? (
                  <p className="profile-bio">{user.aniListProfile.about}</p>
                ) : (
                  <p className="profile-bio profile-bio-empty">
                    Hope you had a great day!
                  </p>
                )}
              </div>
            </div>
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
                  3-30 characters: letters, numbers, underscores, or hyphens.
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

        <HomePersonalSections user={user} hideWatchlist />

        <ProfileStatsSection stats={stats} daysWatched={daysWatched} />

        <ProfileFavorites favorites={user.favorites ?? []} />

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
              ["whiteMode", "White Mode (Experimental)", "Switch to a clean, high-contrast light theme across the application."],
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
              ["notifyEpisodes", "New Episode Alerts", "Notify when a new subbed episode airs for a show you're watching."],
              ["notifyDubs", "New Dub Alerts", "Notify when a new English dub episode drops for a show you're watching."],
              ["notifyUpcoming", "Airing Soon Reminders", "Remind you shortly before the next episode airs for a show you're watching."],
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

          <div className="profile-setting-row">
            <div>
              <strong>News Alerts</strong>
              <span>Notify when industry news drops for anime matching selected watch statuses.</span>
            </div>
            <DropdownMultiSelect
              options={[
                { value: "watching", label: "Watching" },
                { value: "planning", label: "Planning to Watch" },
                { value: "completed", label: "Watched" },
                { value: "on_hold", label: "On Hold" },
                { value: "rewatching", label: "Rewatching" },
              ]}
              selected={user.preferences.notifyNewsStatuses ?? ["watching", "planning"]}
              ariaLabel="News Alerts watch status filters"
              dropup
              onChange={(value) => void updatePreference({ notifyNewsStatuses: value })}
            />
          </div>

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
