import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileStatBars } from "@/components/profile-stat-bars";
import { ProfileFavorites } from "@/components/profile-favorites";
import { getPublicProfile } from "@/lib/account-store";
import { getDisplayTitle, scoreLabel } from "@/lib/format";
import { computeLibraryStats, computeYearsInReview } from "@/lib/profile-stats";

type PublicProfileProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({
  params,
}: PublicProfileProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    return { title: "Profile not found" };
  }

  return {
    title: `${profile.displayName} (@${profile.username}) · Celestia`,
    description:
      profile.about || `${profile.displayName}'s anime profile on Celestia.`,
    openGraph: {
      images: profile.banner
        ? [profile.banner]
        : profile.avatar
          ? [profile.avatar]
          : [],
    },
  };
}

export default async function PublicProfilePage({
  params,
}: PublicProfileProps) {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const stats = computeLibraryStats(profile.libraryEntries);
  const topYear = computeYearsInReview(profile.libraryEntries)[0] ?? null;
  const finished = profile.libraryEntries.filter(
    (entry) => entry.status === "completed",
  ).length;

  return (
    <div className="profile-page">
      <section className="profile-hero">
        {profile.banner ? (
          <Image
            src={profile.banner}
            alt=""
            fill
            priority
            sizes="100vw"
            className="profile-hero-banner"
          />
        ) : null}
        <div className="profile-hero-scrim" />
        <div className="page-shell profile-hero-content">
          <div className="profile-header-row">
            <div className="profile-header-copy">
              <span className="profile-avatar">
                {profile.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt={profile.displayName}
                    fill
                    sizes="120px"
                    className="poster-image"
                  />
                ) : (
                  <span className="avatar-fallback">
                    {profile.displayName.slice(0, 1)}
                  </span>
                )}
              </span>
              <div className="profile-identity">
                <h1>{profile.displayName}</h1>
                <p className="profile-handle">
                  <span>@{profile.username}</span>
                  {profile.pronouns ? (
                    <span className="profile-pronouns">{profile.pronouns}</span>
                  ) : null}
                </p>
                {profile.about ? (
                  <p className="profile-bio">{profile.about}</p>
                ) : null}
                {profile.aniListUrl ? (
                  <a
                    className="secondary-action profile-edit-trigger"
                    href={profile.aniListUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on AniList
                  </a>
                ) : null}
              </div>
            </div>

            <div className="profile-stats-inline">
              {profile.daysWatched != null ? (
                <div>
                  <strong>{profile.daysWatched.toFixed(1)}</strong>
                  <span>Days Watched</span>
                </div>
              ) : null}
              <div>
                <strong>{finished}</strong>
                <span>Anime Finished</span>
              </div>
              <div>
                <strong>{stats.total}</strong>
                <span>Total Anime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell profile-body">
        {topYear ? (
          <section className="profile-section">
            <h2>Year in review</h2>
            <div className="profile-wrapped-card">
              <div className="profile-wrapped-head">
                <span className="profile-wrapped-year-label">
                  {topYear.year}
                </span>
                <p className="profile-wrapped-headline">
                  <strong>{topYear.completed}</strong> anime completed
                </p>
              </div>
              <div className="profile-wrapped-figures">
                <div>
                  <strong>{topYear.episodes}</strong>
                  <span>Episodes</span>
                </div>
                {topYear.meanScore != null ? (
                  <div>
                    <strong>{scoreLabel(topYear.meanScore)}</strong>
                    <span>Mean score</span>
                  </div>
                ) : null}
                {topYear.topGenre ? (
                  <div>
                    <strong>{topYear.topGenre}</strong>
                    <span>Top genre</span>
                  </div>
                ) : null}
              </div>
              {topYear.topAnime ? (
                <Link
                  href={`/anime/${topYear.topAnime.id}`}
                  className="profile-wrapped-top"
                >
                  <span className="profile-wrapped-top-poster">
                    {topYear.topAnime.coverImage ? (
                      <Image
                        src={topYear.topAnime.coverImage}
                        alt=""
                        fill
                        sizes="56px"
                        className="poster-image"
                      />
                    ) : null}
                  </span>
                  <span className="profile-wrapped-top-meta">
                    <span>Favourite of the year</span>
                    <strong>{getDisplayTitle(topYear.topAnime.title)}</strong>
                  </span>
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        <ProfileFavorites favorites={profile.favorites} />

        {stats.total > 0 ? (
          <section className="profile-section">
            <h2>Stats</h2>
            <div className="profile-stats-grid">
              {stats.statusBreakdown.length ? (
                <div className="profile-stats-card">
                  <h3>Status</h3>
                  <ProfileStatBars
                    items={stats.statusBreakdown.map((item) => ({
                      label: item.label,
                      count: item.count,
                    }))}
                  />
                </div>
              ) : null}
              {stats.topGenres.length ? (
                <div className="profile-stats-card">
                  <h3>Top genres</h3>
                  <ProfileStatBars items={stats.topGenres} />
                </div>
              ) : null}
              {stats.formatBreakdown.length ? (
                <div className="profile-stats-card">
                  <h3>Formats</h3>
                  <ProfileStatBars items={stats.formatBreakdown} />
                </div>
              ) : null}
              {stats.decadeBreakdown.length ? (
                <div className="profile-stats-card">
                  <h3>By decade</h3>
                  <ProfileStatBars items={stats.decadeBreakdown} />
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <p className="profile-empty">This profile has no public stats yet.</p>
        )}
      </div>
    </div>
  );
}
