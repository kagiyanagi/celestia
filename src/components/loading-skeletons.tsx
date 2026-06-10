"use client";

import React from "react";
import { ChevronRight, Radio } from "lucide-react";

// Helper for repeating elements
const repeat = (count: number, render: (index: number) => React.ReactNode) =>
  Array.from({ length: count }, (_, index) => render(index));

/* ─── 1. Home Loading Skeleton ─── */
export function HomeSkeleton() {
  return (
    <div className="home-skeleton-wrapper" aria-label="Loading homepage">
      {/* Hero Slide Skeleton */}
      <div className="celestia-hero" style={{ height: "70vh", minHeight: "540px" }}>
        <div className="skeleton" style={{ width: "100%", height: "100%" }} />
        <div className="celestia-hero-shade" />
        <div className="celestia-copy" style={{ zIndex: 10 }}>
          <div className="celestia-copy-main" style={{ width: "100%" }}>
            <div className="skeleton-text" style={{ width: "60%", height: "3.2rem", marginBottom: "16px" }} />
            <div className="skeleton-text" style={{ width: "40%", height: "1.1rem", marginBottom: "8px" }} />
            <div className="skeleton-text" style={{ width: "80%", height: "0.9rem", marginBottom: "8px" }} />
            <div className="skeleton-text" style={{ width: "70%", height: "0.9rem", marginBottom: "24px" }} />
            <div className="celestia-pills" style={{ marginBottom: "20px" }}>
              {repeat(4, (i) => (
                <div key={i} className="skeleton" style={{ width: "70px", height: "30px", borderRadius: "999px" }} />
              ))}
            </div>
            <div className="celestia-actions">
              <div className="skeleton" style={{ width: "140px", height: "46px", borderRadius: "999px" }} />
              <div className="skeleton" style={{ width: "46px", height: "46px", borderRadius: "999px" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell" style={{ marginTop: "24px" }}>
        {/* Genre Chips Skeleton */}
        <div className="browse-genre-pills" style={{ margin: "12px 0 24px" }}>
          {repeat(10, (i) => (
            <div key={i} className="skeleton" style={{ width: "90px", height: "34px", borderRadius: "999px" }} />
          ))}
        </div>

        {/* Trending Rail Skeleton */}
        <div className="home-section" style={{ padding: "24px", borderRadius: "16px" }}>
          <div className="home-section-head">
            <div className="skeleton-text" style={{ width: "160px", height: "28px" }} />
            <div className="skeleton-text" style={{ width: "80px", height: "20px" }} />
          </div>
          <div className="trending-rail" style={{ display: "flex", gap: "16px", overflow: "hidden" }}>
            {repeat(6, (i) => (
              <div key={i} className="skeleton" style={{ flex: "0 0 200px", height: "280px", borderRadius: "16px" }} />
            ))}
          </div>
        </div>

        {/* Season Rail Skeleton */}
        <div className="home-section" style={{ padding: "24px", borderRadius: "16px" }}>
          <div className="home-section-head">
            <div className="skeleton-text" style={{ width: "220px", height: "28px" }} />
            <div className="skeleton-text" style={{ width: "80px", height: "20px" }} />
          </div>
          <div className="trending-rail" style={{ display: "flex", gap: "16px", overflow: "hidden" }}>
            {repeat(6, (i) => (
              <div key={i} className="skeleton" style={{ flex: "0 0 200px", height: "280px", borderRadius: "16px" }} />
            ))}
          </div>
        </div>

        {/* Airing Board Skeleton */}
        <div className="airing-board" style={{ padding: "24px", borderRadius: "16px" }}>
          <div className="home-section-head">
            <div className="skeleton-text" style={{ width: "180px", height: "28px" }} />
          </div>
          <div style={{ display: "grid", gap: "12px" }}>
            {repeat(4, (i) => (
              <div key={i} className="skeleton" style={{ width: "100%", height: "64px", borderRadius: "12px" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 2. Browse Pages Loading Skeleton ─── */
export function BrowseSkeleton() {
  return (
    <div className="page-shell compact-page" aria-label="Loading browse grid">
      <section className="search-hero browse-hero">
        <div className="skeleton-text" style={{ width: "120px", height: "14px", marginBottom: "12px" }} />
        <div className="skeleton-text" style={{ width: "240px", height: "36px", marginBottom: "16px" }} />
        <div className="skeleton-text" style={{ width: "480px", height: "18px" }} />
      </section>

      <section className="section-shell">
        {/* Mock Filter Bar */}
        <div className="browse-filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div className="skeleton" style={{ flex: "1 1 200px", height: "46px", borderRadius: "12px" }} />
          {repeat(4, (i) => (
            <div key={i} className="skeleton" style={{ width: "140px", height: "46px", borderRadius: "12px" }} />
          ))}
        </div>

        {/* Genre pills */}
        <div className="browse-genre-pills" style={{ display: "flex", gap: "8px", overflow: "hidden", marginBottom: "24px" }}>
          {repeat(8, (i) => (
            <div key={i} className="skeleton" style={{ width: "90px", height: "34px", borderRadius: "999px", flexShrink: 0 }} />
          ))}
        </div>

        {/* Heading */}
        <div className="section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div className="skeleton-text" style={{ width: "120px", height: "18px" }} />
          <div className="skeleton" style={{ width: "80px", height: "32px", borderRadius: "8px" }} />
        </div>

        {/* Grid of cards */}
        <div className="anime-grid search-results">
          {repeat(12, (i) => (
            <div key={i} className="anime-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="skeleton" style={{ width: "100%", aspectRatio: "2/3", borderRadius: "12px" }} />
              <div className="skeleton-text" style={{ width: "80%", height: "16px" }} />
              <div className="skeleton-text" style={{ width: "50%", height: "12px" }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── 3. Anime Details Page Loading Skeleton ─── */
export function DetailsSkeleton() {
  return (
    <div className="detail-page" aria-label="Loading details page">
      {/* Banner backdrop placeholder */}
      <div className="detail-hero" style={{ height: "420px", position: "relative", background: "#050505" }}>
        <div className="skeleton" style={{ width: "100%", height: "100%" }} />
        <div className="detail-scrim" />
        <div className="detail-hero-content" style={{ position: "absolute", bottom: "32px", left: "0", right: "0", zIndex: 10, display: "flex", gap: "32px" }}>
          {/* Poster Image */}
          <div className="skeleton" style={{ width: "210px", height: "310px", borderRadius: "16px", flexShrink: 0, boxShadow: "0 20px 40px rgba(0,0,0,0.8)" }} />
          {/* Text details */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "12px" }}>
            <div className="skeleton-text" style={{ width: "75%", height: "3rem", marginBottom: "16px" }} />
            <div className="skeleton-text" style={{ width: "40%", height: "1.2rem", marginBottom: "20px" }} />
            <div className="detail-hero-meta" style={{ marginBottom: "24px", display: "flex", gap: "10px" }}>
              {repeat(5, (i) => (
                <div key={i} className="skeleton" style={{ width: "80px", height: "28px", borderRadius: "999px" }} />
              ))}
            </div>
            <div className="detail-actions" style={{ display: "flex", gap: "12px" }}>
              <div className="skeleton" style={{ width: "150px", height: "46px", borderRadius: "999px" }} />
              <div className="skeleton" style={{ width: "46px", height: "46px", borderRadius: "999px" }} />
              <div className="skeleton" style={{ width: "46px", height: "46px", borderRadius: "999px" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="page-shell" style={{ marginTop: "32px" }}>
        <div className="details-tabs" style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "24px" }}>
          {repeat(6, (i) => (
            <div key={i} className="skeleton" style={{ width: "100px", height: "36px", borderRadius: "8px" }} />
          ))}
        </div>

        {/* Columns: Left sidebar and Right details */}
        <div className="detail-content" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "40px" }}>
          {/* Sidebar */}
          <div style={{ display: "grid", gap: "20px", alignContent: "start" }}>
            {repeat(4, (i) => (
              <div key={i} className="stat-box" style={{ padding: "16px", borderRadius: "12px", height: "80px" }}>
                <div className="skeleton-text" style={{ width: "50%", height: "12px", marginBottom: "8px" }} />
                <div className="skeleton-text" style={{ width: "80%", height: "20px" }} />
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div style={{ display: "grid", gap: "32px" }}>
            {/* Synopsis */}
            <div>
              <div className="skeleton-text" style={{ width: "150px", height: "20px", marginBottom: "16px" }} />
              <div className="skeleton-text" style={{ width: "100%", height: "14px", marginBottom: "8px" }} />
              <div className="skeleton-text" style={{ width: "95%", height: "14px", marginBottom: "8px" }} />
              <div className="skeleton-text" style={{ width: "98%", height: "14px", marginBottom: "8px" }} />
              <div className="skeleton-text" style={{ width: "70%", height: "14px" }} />
            </div>

            {/* Relations */}
            <div>
              <div className="skeleton-text" style={{ width: "120px", height: "20px", marginBottom: "16px" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
                {repeat(3, (i) => (
                  <div key={i} className="skeleton" style={{ height: "96px", borderRadius: "12px" }} />
                ))}
              </div>
            </div>

            {/* Characters */}
            <div>
              <div className="skeleton-text" style={{ width: "140px", height: "20px", marginBottom: "16px" }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                {repeat(4, (i) => (
                  <div key={i} className="skeleton" style={{ height: "80px", borderRadius: "12px" }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 4. Watch Page Loading Skeleton ─── */
export function WatchSkeleton() {
  return (
    <div className="watch-page" aria-label="Loading player page">
      {/* Player Section */}
      <section className="watch-player-stage">
        <div className="watch-player-frame">
          <div className="skeleton" style={{ width: "100%", height: "100%", aspectRatio: "16/9", borderRadius: "16px" }} />
        </div>
      </section>

      {/* Info Block under Player */}
      <div className="watch-shell" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginTop: "20px" }}>
        <div style={{ flex: 1 }}>
          <div className="skeleton-text" style={{ width: "40%", height: "24px", marginBottom: "8px" }} />
          <div className="skeleton-text" style={{ width: "20%", height: "16px" }} />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {repeat(3, (i) => (
            <div key={i} className="skeleton" style={{ width: "110px", height: "36px", borderRadius: "999px" }} />
          ))}
        </div>
      </div>

      {/* Episode Browser Skeleton */}
      <section className="watch-section-panel" style={{ marginTop: "32px" }}>
        <div className="watch-tabs" style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px", marginBottom: "20px" }}>
          <div className="skeleton" style={{ width: "120px", height: "36px", borderRadius: "8px" }} />
          <div className="skeleton" style={{ width: "120px", height: "36px", borderRadius: "8px" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {repeat(6, (i) => (
            <div key={i} className="skeleton" style={{ height: "92px", borderRadius: "16px" }} />
          ))}
        </div>
      </section>

      {/* Related Section */}
      <section className="watch-section-panel" style={{ marginTop: "40px" }}>
        <div className="section-heading" style={{ marginBottom: "20px" }}>
          <div className="skeleton-text" style={{ width: "100px", height: "14px", marginBottom: "8px" }} />
          <div className="skeleton-text" style={{ width: "200px", height: "24px" }} />
        </div>
        <div className="watch-media-grid">
          {repeat(4, (i) => (
            <div key={i} className="skeleton" style={{ height: "96px", borderRadius: "12px" }} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ─── 5. Schedule Page Loading Skeleton ─── */
export function ScheduleSkeleton() {
  return (
    <div className="schedule-shell" aria-label="Loading airing schedule">
      {/* Toolbar */}
      <div className="schedule-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div className="skeleton-text" style={{ width: "180px", height: "20px" }} />
        <div style={{ display: "flex", gap: "10px" }}>
          <div className="skeleton" style={{ width: "120px", height: "36px", borderRadius: "999px" }} />
          <div className="skeleton" style={{ width: "90px", height: "36px", borderRadius: "999px" }} />
        </div>
      </div>

      {/* Spotlight Cards */}
      <section className="schedule-spotlight" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {repeat(3, (i) => (
          <div key={i} className="schedule-spotlight-card" style={{ height: "200px", borderRadius: "16px", position: "relative", overflow: "hidden" }}>
            <div className="skeleton" style={{ width: "100%", height: "100%" }} />
          </div>
        ))}
      </section>

      {/* Jumpbar Shortcuts */}
      <div className="schedule-jumpbar" style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "24px" }}>
        {repeat(5, (i) => (
          <div key={i} className="skeleton" style={{ width: "100px", height: "36px", borderRadius: "999px" }} />
        ))}
      </div>

      {/* Week buttons */}
      <div className="schedule-week" style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "32px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px" }}>
        {repeat(7, (i) => (
          <div key={i} className="skeleton" style={{ width: "90px", height: "42px", borderRadius: "8px" }} />
        ))}
      </div>

      {/* Hour tracks timeline */}
      <div className="schedule-timeline" style={{ display: "grid", gap: "24px" }}>
        {repeat(2, (groupIndex) => (
          <div key={groupIndex} className="schedule-hour-group">
            <div className="schedule-hour-heading" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <ChevronRight size={24} className="muted-strong" />
              <div className="skeleton-text" style={{ width: "70px", height: "24px" }} />
            </div>
            <div className="schedule-hour-track" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
              {repeat(2, (cardIndex) => (
                <div key={cardIndex} className="skeleton" style={{ height: "96px", borderRadius: "16px" }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="schedule-footnote" style={{ marginTop: "40px", display: "flex", justifyContent: "center", gap: "8px", color: "var(--muted)" }}>
        <Radio size={15} />
        <div className="skeleton-text" style={{ width: "240px", height: "14px" }} />
      </div>
    </div>
  );
}

/* ─── 6. History Page Loading Skeleton ─── */
export function HistorySkeleton() {
  return (
    <div className="history-layout page-shell" aria-label="Loading watch history">
      {/* Stats summary row */}
      <div className="history-summary" style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
        {repeat(4, (i) => (
          <div key={i} className="skeleton" style={{ flex: "1 1 140px", height: "76px", borderRadius: "12px" }} />
        ))}
      </div>

      {/* Toolbar controls */}
      <div className="history-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", marginBottom: "32px" }}>
        <div className="skeleton" style={{ flex: 1, minWidth: "240px", height: "46px", borderRadius: "12px" }} />
        <div className="skeleton" style={{ width: "180px", height: "46px", borderRadius: "999px" }} />
        <div className="skeleton" style={{ width: "130px", height: "46px", borderRadius: "999px" }} />
      </div>

      {/* Chronological groups */}
      <div className="history-main" style={{ display: "grid", gap: "32px" }}>
        {repeat(2, (groupIndex) => (
          <section key={groupIndex} className="history-group">
            <div className="skeleton-text" style={{ width: "120px", height: "24px", marginBottom: "16px" }} />
            <div className="history-stack" style={{ display: "grid", gap: "12px" }}>
              {repeat(3, (cardIndex) => (
                <div key={cardIndex} className="skeleton" style={{ width: "100%", height: "96px", borderRadius: "16px" }} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ─── 7. Profile Page Loading Skeleton ─── */
export function ProfileSkeleton() {
  return (
    <div className="profile-page" aria-label="Loading profile">
      {/* Hero with Banner & Avatar details */}
      <section className="profile-hero" style={{ height: "320px", position: "relative", background: "#050505" }}>
        <div className="skeleton" style={{ width: "100%", height: "100%" }} />
        <div className="profile-hero-scrim" />
        <div className="page-shell profile-hero-content" style={{ position: "absolute", bottom: "24px", left: "0", right: "0", zIndex: 10 }}>
          <div className="profile-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "20px" }}>
            <div className="profile-header-copy" style={{ display: "flex", gap: "20px", alignItems: "flex-end" }}>
              {/* Avatar placeholder */}
              <div className="skeleton" style={{ width: "110px", height: "110px", borderRadius: "50%", flexShrink: 0, border: "4px solid black" }} />
              <div>
                <div className="skeleton-text" style={{ width: "180px", height: "28px", marginBottom: "10px" }} />
                <div className="skeleton-text" style={{ width: "100px", height: "16px", marginBottom: "12px" }} />
                <div className="skeleton-text" style={{ width: "240px", height: "14px" }} />
              </div>
            </div>

            {/* Quick stats inline */}
            <div className="profile-stats-inline" style={{ display: "flex", gap: "24px" }}>
              {repeat(3, (i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div className="skeleton-text" style={{ width: "50px", height: "24px", margin: "0 auto 8px" }} />
                  <div className="skeleton-text" style={{ width: "80px", height: "12px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Body content */}
      <div className="page-shell profile-body" style={{ marginTop: "32px", display: "grid", gap: "40px" }}>
        {/* Favorites Section */}
        <section className="profile-section">
          <div className="skeleton-text" style={{ width: "140px", height: "22px", marginBottom: "20px" }} />
          <div style={{ display: "flex", gap: "16px", overflow: "hidden" }}>
            {repeat(5, (i) => (
              <div key={i} className="skeleton" style={{ flex: "0 0 130px", height: "190px", borderRadius: "12px" }} />
            ))}
          </div>
        </section>

        {/* Stats Grid */}
        <section className="profile-section">
          <div className="skeleton-text" style={{ width: "100px", height: "22px", marginBottom: "20px" }} />
          <div className="profile-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {repeat(3, (i) => (
              <div key={i} className="profile-stats-card" style={{ padding: "20px", borderRadius: "16px", background: "var(--panel)" }}>
                <div className="skeleton-text" style={{ width: "100px", height: "18px", marginBottom: "20px" }} />
                {repeat(4, (j) => (
                  <div key={j} style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <div className="skeleton-text" style={{ width: "80px", height: "12px" }} />
                      <div className="skeleton-text" style={{ width: "30px", height: "12px" }} />
                    </div>
                    <div className="skeleton" style={{ width: "100%", height: "8px", borderRadius: "4px" }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── 8. Notifications Page Loading Skeleton ─── */
export function NotificationsSkeleton() {
  return (
    <main className="notifications-page" aria-label="Loading notifications">
      {/* Header */}
      <header className="notifications-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
        <div>
          <div className="skeleton-text" style={{ width: "220px", height: "36px", marginBottom: "12px" }} />
          <div className="skeleton-text" style={{ width: "420px", height: "16px" }} />
        </div>
        <div className="skeleton" style={{ width: "150px", height: "38px", borderRadius: "8px" }} />
      </header>

      {/* List of Notification items */}
      <ul className="notifications-list" style={{ display: "grid", gap: "1px", background: "var(--border-subtle)", borderRadius: "16px", overflow: "hidden" }}>
        {repeat(5, (i) => (
          <li key={i} style={{ display: "flex", gap: "16px", padding: "16px", background: "var(--surface-1)", alignItems: "center" }}>
            {/* Cover image placeholder */}
            <div className="skeleton" style={{ width: "48px", height: "64px", borderRadius: "8px", flexShrink: 0 }} />
            {/* Body copy placeholder */}
            <div style={{ flex: 1, display: "grid", gap: "8px" }}>
              <div className="skeleton-text" style={{ width: "140px", height: "12px" }} />
              <div className="skeleton-text" style={{ width: "320px", height: "16px" }} />
              <div className="skeleton-text" style={{ width: "180px", height: "12px" }} />
            </div>
            {/* Actions button slots */}
            <div style={{ display: "flex", gap: "8px" }}>
              {repeat(3, (j) => (
                <div key={j} className="skeleton" style={{ width: "34px", height: "34px", borderRadius: "50%" }} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

/* ─── 9. Watchlist Page Loading Skeleton ─── */
export function WatchlistSkeleton() {
  return (
    <div className="page-shell watchlist-page" aria-label="Loading watchlist">
      {/* Tabs */}
      <div className="watchlist-tabs" style={{ display: "flex", gap: "8px", overflow: "hidden", marginBottom: "24px" }}>
        {repeat(7, (i) => (
          <div key={i} className="skeleton" style={{ width: "110px", height: "38px", borderRadius: "8px", flexShrink: 0 }} />
        ))}
      </div>

      <section className="watchlist-section">
        {/* Section Head */}
        <div className="watchlist-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
          <div>
            <div className="skeleton-text" style={{ width: "140px", height: "24px", marginBottom: "8px" }} />
            <div className="skeleton-text" style={{ width: "200px", height: "14px" }} />
          </div>
          <div className="watchlist-toolbar" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div className="skeleton" style={{ width: "180px", height: "38px", borderRadius: "8px" }} />
            <div className="skeleton" style={{ width: "120px", height: "38px", borderRadius: "8px" }} />
            {repeat(4, (i) => (
              <div key={i} className="skeleton" style={{ width: "38px", height: "38px", borderRadius: "8px" }} />
            ))}
          </div>
        </div>

        {/* Results grid */}
        <div className="anime-grid search-results">
          {repeat(12, (i) => (
            <div key={i} className="anime-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="skeleton" style={{ width: "100%", aspectRatio: "2/3", borderRadius: "12px" }} />
              <div className="skeleton-text" style={{ width: "80%", height: "16px" }} />
              <div className="skeleton-text" style={{ width: "50%", height: "12px" }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

