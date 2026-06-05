"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Bell, Check, CheckCheck, Mic, Trash2, Tv } from "lucide-react";
import type { AnimeNotification } from "@/types/anime";

/** Lets the header bell re-fetch its unread badge after a change here. */
function broadcastChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("notifications:updated"));
  }
}

interface NotificationsPageShellProps {
  initialNotifications: AnimeNotification[];
  signedIn: boolean;
}

function relativeTime(epochSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diff < 60) return "just now";
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function NotificationsPageShell({
  initialNotifications,
  signedIn,
}: NotificationsPageShellProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [marking, setMarking] = useState(false);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  async function markAllRead() {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    // Optimistic — the server write is a single timestamp.
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, read: true })),
    );
    broadcastChange();
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read-all" }),
      });
    } catch {
      // The read state still reflects locally; next load reconciles.
    } finally {
      setMarking(false);
    }
  }

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
    broadcastChange();
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", ids: [id] }),
    }).catch(() => undefined);
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id),
    );
    broadcastChange();
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", ids: [id] }),
    }).catch(() => undefined);
  }, []);

  return (
    <main className="notifications-page">
      <header className="notifications-head">
        <div>
          <h1>Notifications</h1>
          <p>New episodes and dubs for the anime on your list.</p>
        </div>
        <button
          type="button"
          className="notif-mark-all"
          onClick={markAllRead}
          disabled={marking || unreadCount === 0}
        >
          <CheckCheck size={16} aria-hidden />
          Mark all as read
        </button>
      </header>

      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <Bell size={28} aria-hidden />
          <p>
            {signedIn
              ? "You're all caught up. New episodes from the anime on your list will show up here."
              : "Sign in and add anime to your list to get release notifications."}
          </p>
          {!signedIn ? (
            <Link href="/profile" className="notif-cta">
              Sign in
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="notifications-list">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={`notification-row${notification.read ? "" : " is-unread"}`}
            >
              <Link
                href={`/anime/${notification.animeId}`}
                className="notification-link"
                onClick={() => {
                  if (!notification.read) markRead(notification.id);
                }}
              >
                <span className="notif-cover">
                  {notification.coverImage ? (
                    <Image
                      src={notification.coverImage}
                      alt=""
                      fill
                      sizes="48px"
                    />
                  ) : null}
                </span>
                <span className="notif-body">
                  <span className="notif-kind">
                    {notification.type === "dub" ? (
                      <Mic size={13} aria-hidden />
                    ) : (
                      <Tv size={13} aria-hidden />
                    )}
                    {notification.type === "dub"
                      ? "New dub episode"
                      : "New episode"}
                  </span>
                  <strong className="notif-title">{notification.title}</strong>
                  <span className="notif-sub">
                    Episode {notification.episode} •{" "}
                    {relativeTime(notification.airedAt)}
                  </span>
                </span>
                {!notification.read ? (
                  <span className="notif-dot" aria-label="Unread" />
                ) : null}
              </Link>
              <div className="notif-actions">
                {!notification.read ? (
                  <button
                    type="button"
                    className="notif-action"
                    onClick={() => markRead(notification.id)}
                    aria-label="Mark as read"
                    title="Mark as read"
                  >
                    <Check size={16} aria-hidden />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="notif-action"
                  onClick={() => dismiss(notification.id)}
                  aria-label="Delete notification"
                  title="Delete"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
