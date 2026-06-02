"use client";

import Image from "next/image";
import Link from "next/link";
import { Monitor, Play, SlidersHorizontal, Smartphone, UserRound, LogOut, Link2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

const tabs = [
  { key: "account", label: "My Account", icon: UserRound },
  { key: "anime", label: "Anime", icon: SlidersHorizontal },
  { key: "playback", label: "Playback", icon: Play },
  { key: "import", label: "Import List", icon: Link2 },
  { key: "devices", label: "Devices", icon: Smartphone },
] as const;

export function SettingsPageShell() {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["key"]>("account");
  const [message, setMessage] = useState("");

  if (!user) {
    return null;
  }

  async function updatePreference(next: Record<string, unknown>) {
    setMessage("");
    const response = await fetch("/api/me/preferences", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(next),
    });
    const payload = (await response.json()) as { user?: typeof user };
    if (!response.ok) {
      setMessage("Could not update preferences.");
      return;
    }
    if (payload.user) {
      setUser(payload.user);
    }
  }

  async function updateProfile(formData: FormData) {
    setMessage("");
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: String(formData.get("displayName") || ""),
        username: String(formData.get("username") || ""),
        pronouns: String(formData.get("pronouns") || ""),
        about: String(formData.get("about") || ""),
      }),
    });
    const payload = (await response.json()) as { user?: typeof user };
    if (!response.ok) {
      setMessage("Could not update profile.");
      return;
    }
    if (payload.user) {
      setUser(payload.user);
      setMessage("Settings saved.");
    }
  }

  return (
    <div className="page-shell settings-page">
      <h1>Settings</h1>
      <div className="settings-layout">
        <aside className="settings-sidebar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                className={activeTab === tab.key ? "active" : ""}
                type="button"
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
          <button
            className="danger-link"
            type="button"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/";
              });
            }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </aside>

        <section className="settings-content">
          {activeTab === "account" ? (
            <div className="settings-grid account-settings-grid">
              <form
                className="settings-form-column"
                onSubmit={(event) => {
                  event.preventDefault();
                  void updateProfile(new FormData(event.currentTarget));
                }}
              >
                <label>
                  Display Name
                  <input name="displayName" defaultValue={user.displayName} />
                </label>
                <label>
                  Username
                  <input name="username" defaultValue={user.username} />
                </label>
                <label>
                  Pronouns
                  <input name="pronouns" defaultValue={user.pronouns} placeholder="Add your pronouns" />
                </label>
                <label>
                  About Me
                  <textarea name="about" rows={4} defaultValue={user.about} placeholder="Tell us something about yourself..." />
                </label>
                <button type="submit" className="primary-action">Save account</button>
                {message ? <p className="settings-message">{message}</p> : null}
              </form>
              <div className="settings-profile-preview">
                <div className="settings-profile-card">
                  <div className="settings-profile-banner">
                    {user.banner ? <Image src={user.banner} alt="" fill sizes="400px" className="poster-image" /> : null}
                  </div>
                  <div className="settings-profile-avatar">
                    {user.avatar ? (
                      <Image src={user.avatar} alt={user.displayName} fill sizes="96px" className="poster-image" />
                    ) : (
                      <span className="avatar-fallback">{user.displayName.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className="settings-profile-copy">
                    <strong>{user.displayName}</strong>
                    <span>@{user.username}</span>
                  </div>
                  <Link href="/profile" className="primary-action settings-profile-link">Go to profile</Link>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "anime" ? (
            <div className="settings-stack">
              <div className="settings-row">
                <div>
                  <h2>Anime Title Language</h2>
                  <p>Choose how anime titles should be displayed throughout the app.</p>
                </div>
                <select
                  value={user.preferences.titleLanguage}
                  onChange={(event) => void updatePreference({ titleLanguage: event.target.value })}
                >
                  <option value="english">English (Attack on Titan)</option>
                  <option value="romaji">Romaji (Shingeki no Kyojin)</option>
                  <option value="native">Native</option>
                </select>
              </div>
              <div className="settings-toggle-row">
                <div>
                  <h2>Hide Adult Content</h2>
                  <p>Enable this to hide content intended for mature audiences (18+).</p>
                </div>
                <button className={`switch ${user.preferences.hideAdultContent ? "on" : ""}`} type="button" onClick={() => void updatePreference({ hideAdultContent: !user.preferences.hideAdultContent })} />
              </div>
              <div className="settings-toggle-row">
                <div>
                  <h2>Autoplay Trailers</h2>
                  <p>Automatically play anime trailers on cards, the homepage, and other preview areas.</p>
                </div>
                <button className={`switch ${user.preferences.autoplayTrailers ? "on" : ""}`} type="button" onClick={() => void updatePreference({ autoplayTrailers: !user.preferences.autoplayTrailers })} />
              </div>
            </div>
          ) : null}

          {activeTab === "playback" ? (
            <div className="settings-stack">
              <div className="settings-row">
                <div>
                  <h2>Video Quality Preference</h2>
                  <p>Choose your preferred video quality. &quot;Auto&quot; adjusts based on network speed.</p>
                </div>
                <select value={user.preferences.videoQuality} onChange={(event) => void updatePreference({ videoQuality: event.target.value })}>
                  <option value="higher_picture_quality">Higher picture quality</option>
                  <option value="auto">Auto</option>
                  <option value="data_saver">Data saver</option>
                </select>
              </div>
              {[
                ["autoPlay", "Auto Play", "Automatically start playing media when it loads."],
                ["autoNext", "Auto Next", "Play the next episode automatically when the current one finishes."],
                ["autoSkipIntroOutro", "Auto Skip Intro/Outro", "Automatically skip intros and outros when possible."],
                ["miniPlayer", "MiniPlayer", "Minimize the player when you scroll away or leave the watch page."],
              ].map(([key, label, description]) => (
                <div className="settings-toggle-row" key={key}>
                  <div>
                    <h2>{label}</h2>
                    <p>{description}</p>
                  </div>
                  <button
                    className={`switch ${user.preferences[key as keyof typeof user.preferences] ? "on" : ""}`}
                    type="button"
                    onClick={() =>
                      void updatePreference({
                        [key]: !user.preferences[key as keyof typeof user.preferences],
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "import" ? (
            <div className="settings-stack">
              <div className="settings-row import-row">
                <div>
                  <h2>Import AniList</h2>
                  <p>Connect AniList to pull your avatar, banner, list statuses, and recent activity.</p>
                </div>
                <a className="primary-action" href="/api/anilist/connect">
                  {user.aniListProfile ? "Reconnect AniList" : "Connect AniList"}
                </a>
              </div>
            </div>
          ) : null}

          {activeTab === "devices" ? (
            <div className="settings-stack">
              <section>
                <h2>Current device</h2>
                {user.devices.filter((device) => device.current).map((device) => (
                  <div className="device-row" key={device.id}>
                    <span className="device-icon"><Monitor size={18} /></span>
                    <div>
                      <strong>{device.platform} • {device.browser}</strong>
                      <small>{device.locationLabel}</small>
                    </div>
                  </div>
                ))}
              </section>
              <section>
                <h2>Other devices</h2>
                {user.devices.filter((device) => !device.current).map((device) => (
                  <div className="device-row" key={device.id}>
                    <span className="device-icon"><Monitor size={18} /></span>
                    <div>
                      <strong>{device.platform} • {device.browser}</strong>
                      <small>{device.locationLabel} • {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(device.lastActiveAt))}</small>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
