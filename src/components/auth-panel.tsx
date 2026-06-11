"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const defaultSignup = {
  displayName: "",
  username: "",
  email: "",
  password: "",
};

const defaultLogin = {
  email: "",
  password: "",
};

export function AuthPanel() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "anilist">("anilist");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(defaultLogin);
  const [signup, setSignup] = useState(defaultSignup);

  async function submit(endpoint: string, body: Record<string, string>) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Request failed.");
      }

      await refreshUser();
      startTransition(() => router.push("/profile"));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Request failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-panel">
      <div className="auth-header">
        {user?.isGuest ? (
          <div className="guest-badge">Guest Session</div>
        ) : (
          <div className="user-badge">Signed In</div>
        )}
        <h2>{user?.isGuest ? "Welcome to MiruCast" : "Account Settings"}</h2>
        <p>
          {user?.isGuest
            ? "Your progress is being saved locally. Connect AniList to sync across devices."
            : "Manage your connection and account preferences below."}
        </p>
      </div>

      <div className="auth-switch">
        <button
          className={mode === "anilist" ? "active" : ""}
          type="button"
          onClick={() => setMode("anilist")}
        >
          AniList
        </button>
        <button
          className={mode === "login" ? "active" : ""}
          type="button"
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          className={mode === "signup" ? "active" : ""}
          type="button"
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
      </div>

      {mode === "anilist" && (
        <div className="anilist-flow">
          <div className="anilist-benefits">
            <ul>
              <li>Sync your watch list automatically</li>
              <li>Track progress in real-time</li>
              <li>Import your avatar and banner</li>
              <li>Personalized recommendations</li>
            </ul>
          </div>
          <a href="/api/anilist/connect" className="anilist-connect-btn">
            Connect AniList Account
          </a>
        </div>
      )}

      {mode === "login" && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("/api/auth/login", login);
          }}
        >
          <label>
            Email
            <input
              value={login.email}
              onChange={(event) =>
                setLogin((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={login.password}
              onChange={(event) =>
                setLogin((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              type="password"
              required
            />
          </label>
          <button className="primary-action" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      )}

      {mode === "signup" && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit("/api/auth/signup", signup);
          }}
        >
          <label>
            Display name
            <input
              value={signup.displayName}
              onChange={(event) =>
                setSignup((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Username
            <input
              value={signup.username}
              onChange={(event) =>
                setSignup((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Email
            <input
              value={signup.email}
              onChange={(event) =>
                setSignup((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={signup.password}
              onChange={(event) =>
                setSignup((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              type="password"
              minLength={8}
              required
            />
          </label>
          <button className="primary-action" type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create account"}
          </button>
        </form>
      )}

      <div className="auth-footnote">
        {error ? <p className="auth-error">{error}</p> : null}
      </div>
    </section>
  );
}
