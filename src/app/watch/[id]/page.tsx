import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, ListVideo, Play } from "lucide-react";

import { LocalTracker } from "@/components/local-tracker";
import { getDisplayTitle, getSecondaryTitle } from "@/lib/format";
import { getAnimeDetails } from "@/lib/providers/anilist";
import { getStreamSource } from "@/lib/providers/streaming";

type WatchPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    ep?: string;
    page?: string;
    sid?: string;
  }>;
};

const EPISODES_PER_PAGE = 120;

function getEpisodeValue(value: string | undefined): number {
  const parsed = Number(value || 1);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}

function getPageValue(value: string | undefined, episode: number): number {
  const parsed = Number(value);

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return Math.max(1, Math.ceil(episode / EPISODES_PER_PAGE));
}

function episodeHref(animeId: number, episode: number, sidQuery: string): string {
  const page = Math.max(1, Math.ceil(episode / EPISODES_PER_PAGE));

  return `/watch/${animeId}?ep=${episode}&page=${page}${sidQuery}`;
}

export async function generateMetadata({ params, searchParams }: WatchPageProps): Promise<Metadata> {
  const [{ id }, { ep }] = await Promise.all([params, searchParams]);
  const anime = await getAnimeDetails(Number(id));

  return {
    title: anime ? `Episode ${getEpisodeValue(ep)} - ${getDisplayTitle(anime.title)}` : "Watch"
  };
}

export default async function WatchPage({ params, searchParams }: WatchPageProps) {
  const [{ id }, { ep, page, sid }] = await Promise.all([params, searchParams]);
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
    title
  ].filter((value): value is string => Boolean(value));
  const episode = getEpisodeValue(ep);
  const providerAnimeId = sid ? Number(sid) : null;
  const source = await getStreamSource({
    animeTitle: streamLookupTitle,
    providerAnimeId: Number.isFinite(providerAnimeId) ? providerAnimeId : null,
    episode
  });
  const episodes =
    source?.episodes.length
      ? source.episodes
      : Array.from({ length: anime.episodes || episode }, (_, index) => ({
          number: index + 1,
          title: `Episode ${index + 1}`
        }));
  const nextEpisode = episodes.find((item) => item.number === episode + 1);
  const previousEpisode = episodes.find((item) => item.number === episode - 1);
  const sidQuery = source?.animeId ? `&sid=${source.animeId}` : "";
  const pageCount = Math.max(1, Math.ceil(episodes.length / EPISODES_PER_PAGE));
  const episodePage = Math.min(getPageValue(page, episode), pageCount);
  const startIndex = (episodePage - 1) * EPISODES_PER_PAGE;
  const visibleEpisodes = episodes.slice(startIndex, startIndex + EPISODES_PER_PAGE);
  const previousPage = episodePage > 1 ? episodePage - 1 : null;
  const nextPage = episodePage < pageCount ? episodePage + 1 : null;

  return (
    <div className="watch-page">
      <section className="watch-hero">
        {anime.bannerImage ? (
          <Image src={anime.bannerImage} alt="" fill priority sizes="100vw" className="watch-backdrop" />
        ) : null}
        <div className="watch-shade" />

        <div className="watch-shell">
          <div className="watch-topbar">
            <Link href={`/anime/${anime.id}`}>
              <ChevronLeft size={18} aria-hidden />
              Details
            </Link>
            <Link href="/search">Find another anime</Link>
          </div>

          <div className="player-frame">
            {source?.embedUrl ? (
              <iframe
                src={source.embedUrl}
                title={`${title} episode ${episode}`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="player-empty">
                <Play size={42} aria-hidden />
                <h1>Episode is not ready yet.</h1>
                <p>Try another episode or come back later.</p>
              </div>
            )}
          </div>

          <div className="watch-info">
            <div>
              <span className="section-kicker">
                <ListVideo size={16} aria-hidden />
                Episode {episode}
              </span>
              <h1>{title}</h1>
              {secondaryTitle ? <p>{secondaryTitle}</p> : null}
            </div>
            <div className="episode-nav">
              {previousEpisode ? (
                <Link href={episodeHref(anime.id, previousEpisode.number, sidQuery)}>Previous</Link>
              ) : null}
              {nextEpisode ? (
                <Link href={episodeHref(anime.id, nextEpisode.number, sidQuery)}>
                  Next
                  <ChevronRight size={16} aria-hidden />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="watch-content">
        <aside>
          <LocalTracker animeId={anime.id} totalEpisodes={anime.episodes || episodes.length} />
        </aside>

        <section className="episode-panel">
          <div className="section-heading">
            <span>episodes</span>
            <h2>Choose episode</h2>
            <p>
              Showing {startIndex + 1}-{Math.min(startIndex + EPISODES_PER_PAGE, episodes.length)} of{" "}
              {episodes.length}
            </p>
          </div>
          {pageCount > 1 ? (
            <div className="episode-range">
              {previousPage ? (
                <Link
                  href={`/watch/${anime.id}?ep=${(previousPage - 1) * EPISODES_PER_PAGE + 1}&page=${previousPage}${sidQuery}`}
                >
                  Previous batch
                </Link>
              ) : null}
              <span>
                Batch {episodePage} / {pageCount}
              </span>
              {nextPage ? (
                <Link
                  href={`/watch/${anime.id}?ep=${startIndex + EPISODES_PER_PAGE + 1}&page=${nextPage}${sidQuery}`}
                >
                  Next batch
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="episode-grid">
            {visibleEpisodes.map((item) => (
              <Link
                className={item.number === episode ? "episode-pill active" : "episode-pill"}
                href={episodeHref(anime.id, item.number, sidQuery)}
                key={item.number}
              >
                <strong>EP {item.number}</strong>
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
