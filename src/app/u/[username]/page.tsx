import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Calendar, ExternalLink } from "lucide-react";

import { ProfileStatsSection } from "@/components/profile-stats-section";
import { ProfileFavorites } from "@/components/profile-favorites";
import { getPublicProfile } from "@/lib/account-store";
import { computeLibraryStats } from "@/lib/profile-stats";

function formatJoinedDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  } catch {
    return "";
  }
}

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
                <div className="profile-metadata">
                  <span className="metadata-badge">
                    <Calendar size={13} />
                    Joined {formatJoinedDate(profile.joinedAt)}
                  </span>
                  {profile.aniListUrl ? (
                    <a
                      href={profile.aniListUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="metadata-badge interactive"
                    >
                      <ExternalLink size={13} />
                      AniList Profile
                    </a>
                  ) : null}
                </div>
                {profile.about ? (
                  <p className="profile-bio">{profile.about}</p>
                ) : (
                  <p className="profile-bio profile-bio-empty">
                    {"This user hasn't written a biography yet."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell profile-body">
        <ProfileFavorites favorites={profile.favorites} />

        <ProfileStatsSection 
          stats={stats} 
          daysWatched={profile.daysWatched} 
          emptyMessage="This profile has no public stats yet."
        />
      </div>
    </div>
  );
}
