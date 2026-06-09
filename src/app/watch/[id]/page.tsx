import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { buildWatchHref } from "@/lib/watch-href";
import { HeaderImageSetter } from "@/components/header-image-setter";
import { WatchCompletionPrompt } from "@/components/watch-completion-prompt";
import { WatchEpisodeTabs } from "@/components/watch-episode-tabs";
import { WatchPlayerPanel } from "@/components/watch-player-panel";
import { WatchSelectionProvider } from "@/components/watch-selection-context";
import { getSessionUser, getViewerTitleLanguage } from "@/lib/auth";
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

async function MediaCard({ anime, meta }: { anime: AnimeSummary; meta: string }) {
  const titleLanguage = await getViewerTitleLanguage();
  return (
    <Link className="watch-media-card" href={`/anime/${anime.id}`}>
      <div className="watch-media-poster">
        {anime.coverImage ? (
          <Image
            src={anime.coverImage}
            alt={getDisplayTitle(anime.title, titleLanguage)}
            fill
            sizes="96px"
          />
        ) : null}
      </div>
      <div>
        <span>{meta}</span>
        <strong>{getDisplayTitle(anime.title, titleLanguage)}</strong>
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

type EpisodeLink = { number: number; page: number };

type PlayerSectionProps = {
  animeId: number;
  title: string;
  secondaryTitle: string | null;
  episode: number;
  page: number;
  order: "asc" | "desc";
  currentEpisodeTitle: string;
  previousEpisode: EpisodeLink | null;
  nextEpisode: EpisodeLink | null;
  providerOptions: ReturnType<typeof getStreamingProviderOptions>;
  streamingConfigured: boolean;
  trackingAnime: AnimeSummary;
  episodeTitle: string;
  episodeImage: string | null;
  durationLabel: string | null;
  totalEpisodes: number;
  // Source-resolution inputs — awaited inside this boundary so a slow provider
  // never blocks the surrounding shell (episode list, related, recommendations).
  canRequestSource: boolean;
  streamLookupTitle: string[];
  providerAnimeId: number | null;
  audioPreference: StreamAudioType | null;
  server: string | undefined;
  expectedEpisodes: number | null;
};

function PlayerSkeleton() {
  return (
    <section className="watch-player-stage">
      <div className="watch-player-frame">
        <div className="watch-player-skeleton" aria-hidden />
        <div className="watch-player-loading" role="status" aria-live="polite">
          <span className="watch-player-spinner" aria-hidden />
          <span>Finding a source…</span>
        </div>
      </div>
    </section>
  );
}

// Resolves the embed inside a Suspense boundary. The page no longer awaits the
// stream provider before first paint — the shell streams immediately and the
// player swaps in when the (often slow, replaceable) provider responds.
async function PlayerSection({
  canRequestSource,
  streamLookupTitle,
  providerAnimeId,
  audioPreference,
  server,
  expectedEpisodes,
  ...panel
}: PlayerSectionProps) {
  const source = canRequestSource
    ? await getStreamSource({
        animeTitle: streamLookupTitle,
        providerAnimeId,
        episode: panel.episode,
        providerId: server,
        audio: audioPreference,
        expectedEpisodes,
        anilistId: panel.animeId,
      })
    : null;

  return (
    <WatchPlayerPanel
      {...panel}
      // The player only needs the current embed; drop the provider's full
      // episode list (huge for mega-shows) — the browser owns navigation.
      initialSource={source ? { ...source, episodes: [] } : null}
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

  const [anime, viewer] = await Promise.all([
    getAnimeDetails(animeId),
    getSessionUser(),
  ]);

  if (!anime) {
    notFound();
  }

  // Resume: with no explicit episode, jump to the next unwatched episode from
  // the viewer's tracked progress instead of always starting at episode 1.
  if (ep === undefined) {
    const trackedProgress =
      viewer?.libraryEntries.find((entry) => entry.animeId === animeId)
        ?.progress ?? 0;
    if (trackedProgress > 0) {
      const limit = getReleasedEpisodeLimit(anime);
      const maxEpisode = limit ?? anime.episodes ?? trackedProgress;
      const resumeEpisode = Math.min(
        trackedProgress + 1,
        Math.max(1, maxEpisode),
      );
      if (resumeEpisode > 1) {
        redirect(buildWatchHref({ animeId, episode: resumeEpisode }));
      }
    }
  }

  const title = getDisplayTitle(anime.title, viewer?.preferences.titleLanguage);
  const secondaryTitle = getSecondaryTitle(
    anime.title,
    viewer?.preferences.titleLanguage,
  );
  const streamLookupTitle = [
    anime.title?.romaji,
    anime.title?.english,
    anime.title?.userPreferred,
    title,
    ...(anime.synonyms || []),
  ].filter((value): value is string => Boolean(value));
  const requestedEpisode = getEpisodeValue(ep);
  const episodeOrder = getOrderValue(order);
  const audioPreference =
    getAudioValue(audio) ?? viewer?.preferences.defaultAudio ?? null;
  const providerAnimeId = getProviderAnimeId(sid);
  const releasedEpisodeLimit = getReleasedEpisodeLimit(anime);
  const episode = clampEpisodeToLimit(requestedEpisode, releasedEpisodeLimit);
  const canRequestSource =
    releasedEpisodeLimit === null || releasedEpisodeLimit > 0;
  const streamingConfigured = isStreamingConfigured();
  const providerOptions = getStreamingProviderOptions();
  // Honor the remembered server (set by the panel on switch) when the URL
  // carries no explicit server.
  const preferredServer =
    server ?? (await cookies()).get("celestia_server")?.value;
  const activeProviderId =
    getActiveStreamingProviderId(preferredServer) ||
    providerOptions[0]?.id ||
    null;
  const activeProviderAnimeId = providerAnimeId;
  const activeAudio = audioPreference || null;
  // The episode list is built from catalog metadata only, so it renders without
  // waiting on the stream provider (resolved separately in <PlayerSection>).
  const fallbackTotal =
    releasedEpisodeLimit ??
    (anime.streamingEpisodes?.length ||
      anime.airingCount ||
      anime.episodes ||
      episode);
  const episodes = buildEpisodeList({
    providerEpisodes: [],
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

  // The Overview tab shows the episode's own metadata. Rating/airDate come from
  // the merged list; the real synopsis and precise air time come straight from
  // the metadata episode (buildEpisodeList substitutes a generic description).
  const currentMetaEpisode = (anime.streamingEpisodes ?? []).find(
    (item) => Math.floor(item.number) === episode,
  );
  const currentEpisodeOverview = {
    number: episode,
    title: currentEpisode?.title || `Episode ${episode}`,
    description: currentMetaEpisode?.description?.trim() || null,
    rating: currentEpisode?.rating ?? null,
    airDate: currentEpisode?.airDate ?? null,
    airDateTime: currentMetaEpisode?.airDateTime ?? null,
  };

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
        hasSource={canRequestSource && streamingConfigured}
      />

      <WatchSelectionProvider
        initial={{
          server: activeProviderId,
          audio: activeAudio,
          sid: activeProviderAnimeId,
        }}
      >
        {/* Episode switches are real route navigations; keying the boundary on
            the episode remounts the player with a freshly resolved source,
            while server/audio swaps keep the same ep and swap in place. */}
        <Suspense key={`${anime.id}:${episode}`} fallback={<PlayerSkeleton />}>
          <PlayerSection
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
            streamingConfigured={streamingConfigured}
            trackingAnime={recorderAnime}
            episodeTitle={currentEpisode?.title || `Episode ${episode}`}
            episodeImage={currentEpisode?.thumbnail || null}
            durationLabel={anime.duration ? `${anime.duration}:00` : null}
            totalEpisodes={episodes.length}
            canRequestSource={canRequestSource}
            streamLookupTitle={streamLookupTitle}
            providerAnimeId={providerAnimeId}
            audioPreference={audioPreference}
            server={preferredServer}
            expectedEpisodes={anime.episodes ?? anime.airingCount ?? null}
          />
        </Suspense>

        <section className="watch-section-panel" id="episodes">
          <WatchEpisodeTabs
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
            currentEpisode={currentEpisodeOverview}
            trackingAnime={recorderAnime}
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
