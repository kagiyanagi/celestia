import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EpisodeBrowser } from "@/components/episode-browser";
import { HeaderImageSetter } from "@/components/header-image-setter";
import { WatchCompletionPrompt } from "@/components/watch-completion-prompt";
import { WatchPlayerPanel } from "@/components/watch-player-panel";
import { WatchSelectionProvider } from "@/components/watch-selection-context";
import { getDisplayTitle, getSecondaryTitle } from "@/lib/format";
import { getAnimeDetails } from "@/lib/providers/anilist";
import {
  getActiveStreamingProviderId,
  getStreamingProviderOptions,
  getStreamSource,
  isStreamingConfigured,
} from "@/lib/providers/streaming";
import type {
  AnimeStreamingEpisode,
  AnimeSummary,
  RelationItem,
} from "@/types/anime";
import type { StreamAudioType, StreamEpisode } from "@/types/streaming";

type WatchPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    ep?: string;
    page?: string;
    sid?: string;
    server?: string;
    order?: string;
    audio?: string;
  }>;
};

const EPISODES_PER_PAGE = 24;
const RELATED_TYPES = new Set([
  "PREQUEL",
  "SEQUEL",
  "SOURCE",
  "SIDE_STORY",
  "SUMMARY",
  "PARENT",
  "SPIN_OFF",
]);

type WatchEpisode = {
  number: number;
  title: string;
  description: string;
  thumbnail: string | null;
  airDate: string | null;
  rating: number | null;
};

type EpisodeLimitInput = {
  airingCount?: number | null;
  status?: string | null;
};

function getEpisodeValue(value: string | undefined): number {
  const parsed = Number(value || 1);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}

function getProviderAnimeId(value: string | undefined): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function getPageValue(value: string | undefined, defaultPage: number): number {
  const parsed = Number(value);

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }

  return defaultPage;
}

function getOrderValue(value: string | undefined): "asc" | "desc" {
  return value === "desc" ? "desc" : "asc";
}

function getAudioValue(value: string | undefined): StreamAudioType | null {
  return value === "sub" || value === "dub" ? value : null;
}

function isGenericEpisodeTitle(
  value: string | null | undefined,
  number: number,
): boolean {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();

  return normalized === `episode ${number}` || normalized === `ep ${number}`;
}

function getPreferredEpisodeTitle(
  providerTitle: string | null | undefined,
  metadataTitle: string | null | undefined,
  number: number,
): string {
  if (!isGenericEpisodeTitle(providerTitle, number)) {
    return providerTitle || `Episode ${number}`;
  }

  if (!isGenericEpisodeTitle(metadataTitle, number)) {
    return metadataTitle || `Episode ${number}`;
  }

  return providerTitle || metadataTitle || `Episode ${number}`;
}

function getReleasedEpisodeLimit(anime: EpisodeLimitInput): number | null {
  if (anime.status === "RELEASING") {
    return Math.max(0, anime.airingCount || 0);
  }

  if (anime.status === "NOT_YET_RELEASED") {
    return 0;
  }

  return null;
}

function clampEpisodeToLimit(episode: number, limit: number | null): number {
  if (limit === null) {
    return episode;
  }

  if (limit <= 0) {
    return 1;
  }

  return Math.min(episode, limit);
}

function shouldIncludeEpisode(
  episode: number,
  releasedEpisodeLimit: number | null,
): boolean {
  return releasedEpisodeLimit === null || episode <= releasedEpisodeLimit;
}

function buildEpisodeList(input: {
  providerEpisodes: StreamEpisode[];
  metadataEpisodes: AnimeStreamingEpisode[];
  fallbackTotal: number;
  releasedEpisodeLimit: number | null;
  animeTitle: string;
  /** Only a finished show has its full episode set; otherwise don't invent rows. */
  trustFullCount: boolean;
}): WatchEpisode[] {
  const episodesByNumber = new Map<number, WatchEpisode>();

  for (const episode of input.providerEpisodes) {
    const number = Math.max(1, Math.floor(episode.number));

    if (!shouldIncludeEpisode(number, input.releasedEpisodeLimit)) {
      continue;
    }

    episodesByNumber.set(number, {
      number,
      title: episode.title || `Episode ${number}`,
      description: `Watch episode ${number} of ${input.animeTitle}.`,
      thumbnail: null,
      airDate: null,
      rating: null,
    });
  }

  input.metadataEpisodes.forEach((episode, index) => {
    const number =
      Number.isFinite(episode.number) && episode.number > 0
        ? Math.floor(episode.number)
        : index + 1;

    if (!shouldIncludeEpisode(number, input.releasedEpisodeLimit)) {
      return;
    }

    const existing = episodesByNumber.get(number);

    episodesByNumber.set(number, {
      number,
      title: getPreferredEpisodeTitle(existing?.title, episode.title, number),
      description:
        episode.description ||
        existing?.description ||
        `Watch episode ${number} of ${input.animeTitle}.`,
      thumbnail: episode.thumbnail || existing?.thumbnail || null,
      airDate: episode.airDate || existing?.airDate || null,
      rating: episode.rating ?? existing?.rating ?? null,
    });
  });

  const largestKnownEpisode = episodesByNumber.size
    ? Math.max(...episodesByNumber.keys())
    : 0;
  // Pad up to the catalog total only for finished shows, whose full episode set
  // genuinely exists. For hiatus/cancelled/unknown shows, never synthesize past
  // the episodes we actually have — that would invent never-aired episodes.
  const totalEpisodes =
    input.releasedEpisodeLimit ??
    (input.trustFullCount
      ? Math.max(input.fallbackTotal, largestKnownEpisode)
      : largestKnownEpisode);

  for (let number = 1; number <= totalEpisodes; number += 1) {
    if (!episodesByNumber.has(number)) {
      episodesByNumber.set(number, {
        number,
        title: `Episode ${number}`,
        description: `Watch episode ${number} of ${input.animeTitle}.`,
        thumbnail: null,
        airDate: null,
        rating: null,
      });
    }
  }

  return Array.from(episodesByNumber.values()).sort(
    (first, second) => first.number - second.number,
  );
}

function getEpisodePageMap(episodes: WatchEpisode[]): Map<number, number> {
  return new Map(
    episodes.map((episode, index) => [
      episode.number,
      Math.floor(index / EPISODES_PER_PAGE) + 1,
    ]),
  );
}

function MediaCard({ anime, meta }: { anime: AnimeSummary; meta: string }) {
  return (
    <Link className="watch-media-card" href={`/anime/${anime.id}`}>
      <div className="watch-media-poster">
        {anime.coverImage ? (
          <Image
            src={anime.coverImage}
            alt={getDisplayTitle(anime.title)}
            fill
            sizes="96px"
          />
        ) : null}
      </div>
      <div>
        <span>{meta}</span>
        <strong>{getDisplayTitle(anime.title)}</strong>
        <small>
          {[anime.format, anime.season, anime.seasonYear]
            .filter(Boolean)
            .join(" ")}
        </small>
      </div>
    </Link>
  );
}

function RelationCard({ relation }: { relation: RelationItem }) {
  return (
    <MediaCard
      anime={relation.anime}
      meta={relation.relationType.replaceAll("_", " ")}
    />
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: WatchPageProps): Promise<Metadata> {
  const [{ id }, { ep }] = await Promise.all([params, searchParams]);
  const anime = await getAnimeDetails(Number(id));
  const episode = anime
    ? clampEpisodeToLimit(getEpisodeValue(ep), getReleasedEpisodeLimit(anime))
    : getEpisodeValue(ep);

  return {
    title: anime
      ? `Episode ${episode} - ${getDisplayTitle(anime.title)}`
      : "Watch",
  };
}

export default async function WatchPage({
  params,
  searchParams,
}: WatchPageProps) {
  const [{ id }, { ep, page, sid, server, order, audio }] = await Promise.all([
    params,
    searchParams,
  ]);
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
    anime.title?.romaji,
    anime.title?.english,
    anime.title?.userPreferred,
    title,
    ...(anime.synonyms || []),
  ].filter((value): value is string => Boolean(value));
  const requestedEpisode = getEpisodeValue(ep);
  const episodeOrder = getOrderValue(order);
  const audioPreference = getAudioValue(audio);
  const providerAnimeId = getProviderAnimeId(sid);
  const releasedEpisodeLimit = getReleasedEpisodeLimit(anime);
  const episode = clampEpisodeToLimit(requestedEpisode, releasedEpisodeLimit);
  const canRequestSource =
    releasedEpisodeLimit === null || releasedEpisodeLimit > 0;
  const source = canRequestSource
    ? await getStreamSource({
        animeTitle: streamLookupTitle,
        providerAnimeId,
        episode,
        providerId: server,
        audio: audioPreference,
        expectedEpisodes: anime.episodes ?? anime.airingCount ?? null,
        anilistId: anime.id,
      })
    : null;
  const providerOptions = getStreamingProviderOptions();
  const activeProviderId =
    source?.providerId ||
    getActiveStreamingProviderId(server) ||
    providerOptions[0]?.id ||
    null;
  const activeProviderAnimeId = source?.animeId || providerAnimeId;
  const activeAudio = source?.audio || audioPreference || null;
  const fallbackTotal =
    releasedEpisodeLimit ??
    (source?.episodes.length ||
      anime.streamingEpisodes?.length ||
      anime.airingCount ||
      anime.episodes ||
      episode);
  const episodes = buildEpisodeList({
    providerEpisodes: source?.episodes || [],
    metadataEpisodes: anime.streamingEpisodes || [],
    fallbackTotal,
    releasedEpisodeLimit,
    animeTitle: title,
    trustFullCount: anime.status === "FINISHED",
  });
  const ascendingEpisodes = episodes;
  const currentEpisode =
    ascendingEpisodes.find((item) => item.number === episode) ||
    ascendingEpisodes[0];
  const currentEpisodeIndex = ascendingEpisodes.findIndex(
    (item) => item.number === episode,
  );
  const previousEpisode =
    currentEpisodeIndex > 0 ? ascendingEpisodes[currentEpisodeIndex - 1] : null;
  const nextEpisode =
    currentEpisodeIndex >= 0 &&
    currentEpisodeIndex < ascendingEpisodes.length - 1
      ? ascendingEpisodes[currentEpisodeIndex + 1]
      : null;
  const displayEpisodes =
    episodeOrder === "desc" ? [...episodes].reverse() : episodes;
  const episodePages = getEpisodePageMap(displayEpisodes);
  const currentDisplayIndex = displayEpisodes.findIndex(
    (item) => item.number === episode,
  );
  const defaultPage =
    currentDisplayIndex >= 0
      ? Math.floor(currentDisplayIndex / EPISODES_PER_PAGE) + 1
      : 1;
  const pageCount = Math.max(
    1,
    Math.ceil(displayEpisodes.length / EPISODES_PER_PAGE),
  );
  const episodePage = Math.min(getPageValue(page, defaultPage), pageCount);
  const previousEpisodeLink = previousEpisode
    ? {
        number: previousEpisode.number,
        page: episodePages.get(previousEpisode.number) || episodePage,
      }
    : null;
  const nextEpisodeLink = nextEpisode
    ? {
        number: nextEpisode.number,
        page: episodePages.get(nextEpisode.number) || episodePage,
      }
    : null;
  const relatedItems = (anime.relations ?? [])
    .filter((item) => RELATED_TYPES.has(item.relationType))
    .slice(0, 8);
  const recommendations = (anime.recommendations ?? []).slice(0, 8);

  // The history recorder only needs summary fields; drop the episode list
  // (huge for mega-shows) before it crosses to the client and into its POST.
  const recorderAnime = { ...anime };
  delete recorderAnime.streamingEpisodes;

  return (
    <div className="watch-page">
      <HeaderImageSetter image={anime.bannerImage || anime.coverImage} />
      <WatchCompletionPrompt
        anime={recorderAnime}
        episode={episode}
        episodeTitle={currentEpisode?.title || `Episode ${episode}`}
        episodeImage={currentEpisode?.thumbnail || null}
        durationLabel={anime.duration ? `${anime.duration}:00` : null}
        hasSource={Boolean(source?.embedUrl)}
      />

      <WatchSelectionProvider
        initial={{
          server: activeProviderId,
          audio: activeAudio,
          sid: activeProviderAnimeId,
        }}
      >
        <WatchPlayerPanel
          // Episode switches are real route navigations, so the panel stays
          // mounted and its `useState(initialSource)` seed would otherwise go
          // stale (player keeps the old episode while metadata updates). Keying
          // on the episode remounts it with the freshly resolved source; server/
          // audio swaps keep the same ep, so they still swap in place.
          key={`${anime.id}:${episode}`}
          animeId={anime.id}
          title={title}
          secondaryTitle={secondaryTitle}
          episode={episode}
          page={episodePage}
          order={episodeOrder}
          currentEpisodeTitle={currentEpisode?.title || `Episode ${episode}`}
          previousEpisode={previousEpisodeLink}
          nextEpisode={nextEpisodeLink}
          providerOptions={providerOptions}
          streamingConfigured={isStreamingConfigured()}
          // The player only needs the current embed; drop the provider's full
          // episode list (huge for mega-shows) — the browser owns navigation.
          initialSource={source ? { ...source, episodes: [] } : null}
        />

        <section className="watch-section-panel" id="episodes">
          <EpisodeBrowser
            anime={{
              id: anime.id,
              bannerImage: anime.bannerImage,
              coverImage: anime.coverImage,
              dubInfo: anime.dubInfo,
              episodeFlags: anime.episodeFlags,
            }}
            // The full episode list ships in the payload (a few KB gzipped even
            // for 1000+ episode shows) so thumbnails render instantly and the
            // browser searches/pages it client-side.
            episodes={episodes.map((item) => ({
              number: item.number,
              title: item.title,
              description: item.description,
              thumbnail: item.thumbnail,
              airDate: item.airDate,
              rating: item.rating,
            }))}
            activeEpisode={episode}
          />
        </section>
      </WatchSelectionProvider>

      {relatedItems.length > 0 ? (
        <section className="watch-section-panel" id="related">
          <div className="section-heading">
            <span>related</span>
            <h2>Related anime</h2>
          </div>
          <div className="watch-media-grid">
            {relatedItems.map((relation) => (
              <RelationCard
                key={`${relation.relationType}-${relation.anime.id}`}
                relation={relation}
              />
            ))}
          </div>
        </section>
      ) : null}

      {recommendations.length > 0 ? (
        <section className="watch-section-panel" id="more-like-this">
          <div className="section-heading">
            <span>recommended</span>
            <h2>More like this</h2>
          </div>
          <div className="watch-media-grid">
            {recommendations.map((item) => (
              <MediaCard anime={item} key={item.id} meta="Recommendation" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
