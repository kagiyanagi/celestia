"use client";

import React from "react";
import type { LibraryStats } from "@/lib/profile-stats";
import { scoreLabel } from "@/lib/format";
import { RadarChart, DonutChart } from "@/components/profile-stats-visuals";
import { Play, Star, Clock, Library, Compass } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  watching: "hsl(142, 40%, 50%)",     // Muted Emerald green
  rewatching: "hsl(180, 45%, 45%)",   // Muted Cyan
  completed: "hsl(217, 45%, 55%)",    // Muted Royal Blue
  on_hold: "hsl(43, 50%, 50%)",       // Muted Amber
  planning: "hsl(270, 40%, 60%)",     // Muted Purple
  dropped: "hsl(346, 45%, 55%)",      // Muted Rose/Red
};


function getPaletteColor(index: number) {
  // Standard spread of HSL hues for harmonious colors
  const hue = (index * 137.5) % 360; // Use golden angle for optimal hue distribution
  return `hsl(${hue}, 40%, 55%)`;
}

function InteractiveStatBars({
  items,
  colors,
}: {
  items: { label: string; count: number; statusKey?: string }[];
  colors?: Record<string, string>;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="profile-stat-bars">
      {items.map((item, i) => {
        const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
        const color = colors
          ? colors[item.statusKey || item.label] || getPaletteColor(i)
          : getPaletteColor(i);

        return (
          <div key={item.label} className="profile-stat-bar-new">
            <div className="profile-stat-bar-header">
              <div className="profile-stat-bar-label-group">
                <span className="profile-stat-bar-label-dot" style={{ backgroundColor: color }} />
                <span className="profile-stat-bar-name">{item.label}</span>
              </div>
              <span className="profile-stat-bar-metrics">
                <strong>{item.count}</strong>
                <span className="profile-stat-bar-pct">{percentage}%</span>
              </span>
            </div>
            <div className="profile-stat-bar-track-new">
              <div 
                style={{ 
                  width: `${(item.count / max) * 100}%`,
                  backgroundColor: color 
                }} 
                className="profile-stat-bar-fill-new"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProfileStatsSection({
  stats,
  daysWatched,
  emptyMessage,
}: {
  stats: LibraryStats;
  daysWatched?: number | null;
  emptyMessage?: string;
}) {
  if (!stats || stats.total === 0) {
    return (
      <section className="profile-section">
        <h2>Stats</h2>
        <div className="profile-stats-empty-card">
          <Compass size={40} className="profile-empty-icon" />
          <h3>No stats available</h3>
          <p>{emptyMessage || "Add anime to your library to see your stats dashboard."}</p>
        </div>
      </section>
    );
  }

  const statusChartData = stats.statusBreakdown.map((item) => ({
    label: item.label,
    count: item.count,
    color: STATUS_COLORS[item.status] || "var(--text-primary)",
  }));


  const showRadar = stats.topGenres.length >= 3;

  return (
    <section className="profile-section">
      <h2>Stats Dashboard</h2>
      
      {/* KPI Cards Grid */}
      <div className="profile-stats-summary-grid">
        <div className="profile-stat-card-kpi">
          <div className="kpi-icon-wrap" style={{ color: "hsl(217, 45%, 55%)" }}>
            <Library size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Anime</span>
            <strong className="kpi-value">{stats.total}</strong>
          </div>
        </div>

        <div className="profile-stat-card-kpi">
          <div className="kpi-icon-wrap" style={{ color: "hsl(142, 40%, 50%)" }}>
            <Play size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Episodes Watched</span>
            <strong className="kpi-value">{stats.episodesWatched}</strong>
          </div>
        </div>

        <div className="profile-stat-card-kpi">
          <div className="kpi-icon-wrap" style={{ color: "hsl(43, 50%, 50%)" }}>
            <Clock size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Days Watched</span>
            <strong className="kpi-value">
              {daysWatched != null ? daysWatched.toFixed(1) : "—"}
            </strong>
          </div>
        </div>

        <div className="profile-stat-card-kpi">
          <div className="kpi-icon-wrap" style={{ color: "hsl(325, 40%, 60%)" }}>
            <Star size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Mean Score</span>
            <strong className="kpi-value">
              {stats.meanScore != null ? scoreLabel(stats.meanScore) : "—"}
            </strong>
            {stats.scoredCount > 0 && (
              <span className="kpi-subtext">{stats.scoredCount} rated</span>
            )}
          </div>
        </div>
      </div>

      {/* Charts Visualization Grid */}
      <div className="profile-stats-dashboard-grid">
        {stats.statusBreakdown.length > 0 && (
          <div className="profile-dashboard-card">
            <h3>Status Distribution</h3>
            <div className="profile-dashboard-card-inner">
              <div className="chart-wrapper donut">
                <DonutChart items={statusChartData} size={220} hideLegend />
              </div>
              <div className="details-wrapper">
                <InteractiveStatBars 
                  items={stats.statusBreakdown.map((item) => ({
                    label: item.label,
                    count: item.count,
                    statusKey: item.status
                  }))}
                  colors={STATUS_COLORS}
                />
              </div>
            </div>
          </div>
        )}
        {stats.topGenres.length > 0 && (
          <div className="profile-dashboard-card">
            <h3>Genre Breakdown</h3>
            <div className="profile-dashboard-card-inner">
              {showRadar ? (
                <div className="chart-wrapper radar">
                  <RadarChart items={stats.topGenres.slice(0, 6)} size={260} />
                </div>
              ) : null}
              <div className="details-wrapper">
                <InteractiveStatBars 
                  items={stats.topGenres.slice(0, 5).map((item) => ({
                    label: item.label,
                    count: item.count,
                  }))}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
