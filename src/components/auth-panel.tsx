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
  const { refreshUser } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
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
      <div className="auth-switch">
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

      {mode === "login" ? (
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
                setLogin((current) => ({ ...current, email: event.target.value }))
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
      ) : (
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
                setSignup((current) => ({ ...current, email: event.target.value }))
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
        <p>Link AniList after sign in to sync your list, avatar, banner, and recent activity.</p>
        {error ? <p className="auth-error">{error}</p> : null}
      </div>
    </section>
  );
}
