"use client";

import Link from "next/link";
import { Bell, Menu, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchModal } from "./search-modal";

export function SiteHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`site-header ${isScrolled ? "is-scrolled" : "is-top"}`}
      >
        <div className="site-header-row">
          <div className="site-header-brand">
            <button
              className="header-icon-button"
              type="button"
              aria-label="Open navigation"
            >
              <Menu size={18} aria-hidden />
            </button>
            <Link className="brand-mark" href="/" aria-label="Celstia home">
              CELSTIA
            </Link>
          </div>

          <div className="site-header-spacer" />

          <nav className="site-header-actions" aria-label="Primary navigation">
            <button
              className="header-icon-button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
            >
              <Search size={18} aria-hidden />
            </button>
            <Link
              className="header-icon-button header-link-button"
              href="/airing"
              aria-label="Airing"
            >
              <Bell size={18} aria-hidden />
            </Link>
            <span className="header-avatar" aria-hidden>
              <UserRound size={18} />
            </span>
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
