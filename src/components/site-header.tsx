"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bell, Search, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

// The search modal is interaction-only - keep its code out of the every-page
// baseline bundle and load it on first open. It renders null while closed, so
// deferring its mount is behaviorally identical.
const SearchModal = dynamic(() =>
  import("./search-modal").then((module) => module.SearchModal),
);

const NOTIFICATION_COUNT_TTL_MS = 60_000;

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const isHomePage = pathname === "/";

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Refresh the unread badge per route change (provider data is cached, so
  // repeat lookups are cheap), on demand when the notifications page changes
  // read/dismiss state, and clear it when signed out.
  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    const cacheKey = `mirucast:notifications:count:${userId}`;
    const refresh = (force = false) => {
      if (!force) {
        try {
          const cached = JSON.parse(
            window.sessionStorage.getItem(cacheKey) || "null",
          ) as { unreadCount: number; fetchedAt: number } | null;
          if (
            cached &&
            Date.now() - cached.fetchedAt < NOTIFICATION_COUNT_TTL_MS
          ) {
            setUnreadCount(cached.unreadCount || 0);
            return;
          }
        } catch {
          window.sessionStorage.removeItem(cacheKey);
        }
      }

      fetch("/api/notifications/count")
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { unreadCount?: number } | null) => {
          if (!cancelled && data) {
            const nextCount = data.unreadCount || 0;
            setUnreadCount(nextCount);
            window.sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ unreadCount: nextCount, fetchedAt: Date.now() }),
            );
          }
        })
        .catch(() => undefined);
    };

    refresh();
    const forceRefresh = () => refresh(true);
    window.addEventListener("notifications:updated", forceRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener("notifications:updated", forceRefresh);
    };
  }, [userId, pathname]);

  const badgeCount = user ? unreadCount : 0;

  return (
    <>
      <header
        className={`site-header ${isScrolled ? "is-scrolled" : "is-top"}`}
      >
        <div className="site-header-row">
          <div className="site-header-brand">
            {!isHomePage ? (
              <button
                className="header-icon-button"
                type="button"
                onClick={handleBack}
                aria-label="Go back"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
            ) : null}
            <Link className="brand-mark" href="/" aria-label="MiruCast home">
              MIRUCAST
            </Link>
          </div>

          <nav className="site-header-actions" aria-label="Primary navigation">
            <button
              className="header-icon-button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
            >
              <Search size={18} aria-hidden />
            </button>
            <Link
              className="header-icon-button header-link-button header-notif-button"
              href="/notifications"
              aria-label={
                badgeCount > 0
                  ? `Notifications, ${badgeCount} unread`
                  : "Notifications"
              }
            >
              <Bell size={18} aria-hidden />
              {badgeCount > 0 ? (
                <span className="notif-badge">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              ) : null}
            </Link>
            <Link
              className="header-avatar"
              href="/profile"
              aria-label="Profile"
            >
              {user?.avatar ? (
                <Image
                  className="avatar-image"
                  src={user.avatar}
                  alt=""
                  width={34}
                  height={34}
                />
              ) : (
                <UserRound size={18} />
              )}
            </Link>
          </nav>
        </div>
      </header>

      {isSearchOpen && (
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </>
  );
}
