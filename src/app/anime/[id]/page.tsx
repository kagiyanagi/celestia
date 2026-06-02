import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Calendar,
  Clapperboard,
  Heart,
  Play,
  RadioTower,
  Star,
} from "lucide-react";

import { AnimeCard } from "@/components/anime-card";
import { LocalTracker } from "@/components/local-tracker";
import { SectionShell } from "@/components/section-shell";
import {
  compactNumber,
  episodeLabel,
  getDisplayTitle,
  getSecondaryTitle,
  minutesLabel,
  scoreLabel,
} from "@/lib/format";
import { getAnimeDetails } from "@/lib/providers/anilist";
import { findStreamAvailability } from "@/lib/providers/streaming";

type AnimePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({
  params,
}: AnimePageProps): Promise<Metadata> {
  const { id } = await params;
  const anime = await getAnimeDetails(Number(id));

  if (!anime) {
    return {
      title: "Anime not found",
    };
  }

  return {
    title: getDisplayTitle(anime.title),
    description: anime.description || undefined,
    openGraph: {
      images:
        anime.bannerImage || anime.coverImage
          ? [anime.bannerImage || anime.coverImage || ""]
          : [],
    },
  };
}

export default async function AnimePage({ params }: AnimePageProps) {
  const { id } = await params;
  const animeId = Number(id);

  if (!Number.isFinite(animeId)) {
    notFound();
  }

  const anime = await getAnimeDetails(animeId);

  if (!anime) {
    notFound();
  }

  const title = getDisplayTitle(anime.title);
  const secondaryTitle = getSecondaryTitle(anime.title);
  const streamLookupTitle = [
    anime.title.romaji,
    anime.title.english,
    anime.title.userPreferred,
    title,
  ].filter((value): value is string => Boolean(value));
  const streamAvailability = await findStreamAvailability(streamLookupTitle);
  const watchHref = `/watch/${anime.id}?ep=1${
    streamAvailability.providerAnimeId
      ? `&sid=${streamAvailability.providerAnimeId}`
      : ""
  }`;

  return (
    <div className="detail-page">
      <section className="detail-hero">
        {anime.bannerImage ? (
          <Image
            src={anime.bannerImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="detail-backdrop"
          />
        ) : null}
        <div className="detail-scrim" />

        <div className="detail-hero-content">
          <div className="detail-poster">
            {anime.coverImage ? (
              <Image
                src={anime.coverImage}
                alt=""
                fill
                priority
                sizes="260px"
              />
            ) : (
              <span>Celstia</span>
            )}
          </div>

          <div className="detail-copy">
            <span className="section-kicker">
              <BadgeCheck size={16} aria-hidden />
              {anime.format || "Anime"}{" "}
              {anime.status ? `/${anime.status.replaceAll("_", " ")}` : ""}
            </span>
            <h1>{title}</h1>
            {secondaryTitle ? (
              <p className="native-title">{secondaryTitle}</p>
            ) : null}
            <div className="detail-hero-meta">
              <span>
                {anime.season && anime.seasonYear
                  ? `${anime.season} ${anime.seasonYear}`
                  : "Unknown season"}
              </span>
              <span>
                {anime.studios.map((studio) => studio.name).join(", ") ||
                  "Unknown studio"}
              </span>
              <span>{scoreLabel(anime.averageScore)}</span>
            </div>
            <p className="detail-description">
              {anime.description ||
                "No synopsis is available for this title yet."}
            </p>
            <div className="detail-actions">
              <Link className="watch-button" href={watchHref}>
                <Play size={18} aria-hidden />
                Watch episode 1
              </Link>
              <Link href="/search">Find more anime</Link>
              {anime.externalLinks[0] ? (
                <a
                  href={anime.externalLinks[0].url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Official page
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="detail-content">
        <aside className="detail-sidebar">
          <div className="stats-grid">
            <div className="stat-card">
              <Star size={18} aria-hidden />
              <span>Score</span>
              <strong>{scoreLabel(anime.averageScore)}</strong>
            </div>
            <div className="stat-card">
              <Clapperboard size={18} aria-hidden />
              <span>Episodes</span>
              <strong>{episodeLabel(anime.episodes)}</strong>
            </div>
            <div className="stat-card">
              <Calendar size={18} aria-hidden />
              <span>Runtime</span>
              <strong>{minutesLabel(anime.duration)}</strong>
            </div>
            <div className="stat-card">
              <Heart size={18} aria-hidden />
              <span>Popularity</span>
              <strong>{compactNumber(anime.popularity)}</strong>
            </div>
          </div>

          <LocalTracker animeId={anime.id} totalEpisodes={anime.episodes} />

          <section className="stream-card">
            <span className="section-kicker">
              <RadioTower size={16} aria-hidden />
              episodes
            </span>
            <h2>
              {streamAvailability.available
                ? "Ready to watch"
                : "Not available yet"}
            </h2>
            <p>
              {streamAvailability.available
                ? `${streamAvailability.episodeCount || anime.episodes || "Multiple"} episodes are available from the watch page.`
                : "This title can still be tracked, but episodes are not available right now."}
            </p>
            {streamAvailability.available ? (
              <Link className="wide-watch-link" href={watchHref}>
                <Play size={18} aria-hidden />
                Start watching
              </Link>
            ) : null}
          </section>
        </aside>

        <div className="detail-main">
          <section className="fact-panel">
            <div>
              <span>Format</span>
              <strong>{anime.format || "Unknown"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{anime.status?.replaceAll("_", " ") || "Unknown"}</strong>
            </div>
            <div>
              <span>Season</span>
              <strong>
                {anime.season && anime.seasonYear
                  ? `${anime.season} ${anime.seasonYear}`
                  : "Unknown"}
              </strong>
            </div>
            <div>
              <span>Studios</span>
              <strong>
                {anime.studios.map((studio) => studio.name).join(", ") ||
                  "Unknown"}
              </strong>
            </div>
          </section>

          <section className="tag-cloud">
            {[...anime.genres, ...anime.tags].slice(0, 18).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </section>

          {anime.characters.length ? (
            <SectionShell eyebrow="cast" title="Characters">
              <div className="character-grid">
                {anime.characters.map((character) => (
                  <article
                    className="character-card"
                    key={`${character.id}-${character.role}`}
                  >
                    <div className="character-image">
                      {character.image ? (
                        <Image src={character.image} alt="" fill sizes="80px" />
                      ) : null}
                    </div>
                    <div>
                      <h3>{character.name}</h3>
                      <p>{character.role || "Cast"}</p>
                      {character.voiceActor ? (
                        <small>VA: {character.voiceActor.name}</small>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </SectionShell>
          ) : null}

          {anime.relations.length ? (
            <SectionShell eyebrow="more from this story" title="Related anime">
              <div className="anime-grid">
                {anime.relations.slice(0, 8).map((relation) => (
                  <AnimeCard
                    anime={relation.anime}
                    key={`${relation.relationType}-${relation.anime.id}`}
                  />
                ))}
              </div>
            </SectionShell>
          ) : null}

          {anime.recommendations.length ? (
            <SectionShell eyebrow="next watch" title="Recommendations">
              <div className="anime-grid">
                {anime.recommendations.map((recommendation) => (
                  <AnimeCard anime={recommendation} key={recommendation.id} />
                ))}
              </div>
            </SectionShell>
          ) : null}
        </div>
      </div>
    </div>
  );
}
