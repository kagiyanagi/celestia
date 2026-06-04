"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bell, Search, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SearchModal } from "./search-modal";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
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
  // repeat lookups are cheap) and clear it when signed out.
  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { unreadCount?: number } | null) => {
        if (!cancelled && data) {
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

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
            <Link className="brand-mark" href="/" aria-label="Celestia home">
              CELESTIA
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
            <Link className="header-avatar" href="/profile" aria-label="Profile">
              {user?.avatar ? (
                <Image src={user.avatar} alt="" width={40} height={40} />
              ) : (
                <UserRound size={18} />
              )}
            </Link>
          </nav>
        </div>
      </header>

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
