import {
  AnimeSummary,
  AnimeDetails,
  CharacterCredit,
  StaffCredit,
  RelationItem,
  VoiceActorCredit,
  Studio,
  AnimeSeason,
  ExternalLink,
  AnimeStreamingEpisode,
} from "@/types/anime";
import { cleanDescription } from "@/lib/format";

export type AniListMedia = {
  id: number;
  idMal: number | null;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  };
  coverImage: {
    extraLarge: string | null;
    large: string | null;
    color: string | null;
  } | null;
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  source: string | null;
  description: string | null;
  episodes: number | null;
  duration: number | null;
  season: AnimeSeason | null;
  seasonYear: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  trending: number | null;
  favourites: number | null;
  genres: string[] | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
    timeUntilAiring: number;
  } | null;
  studios: {
    nodes: Studio[] | null;
  } | null;
};

export type AniListDetailsMedia = AniListMedia & {
  description: string | null;
  source: string | null;
  countryOfOrigin: string | null;
  hashtag: string | null;
  synonyms: string[] | null;
  streamingEpisodes: AnimeStreamingEpisode[] | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  endDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  trailer: {
    id: string | null;
    site: string | null;
    thumbnail: string | null;
  } | null;
  tags: Array<{
    name: string;
    rank: number;
    isMediaSpoiler: boolean;
    isGeneralSpoiler: boolean;
  }> | null;
  rankings: Array<{
    rank: number;
    type: string;
    allTime: boolean;
    context: string;
  }> | null;
  externalLinks: ExternalLink[] | null;
  characters: {
    pageInfo?: {
      hasNextPage?: boolean | null;
    } | null;
    edges: Array<{
      role: string | null;
      node: {
        id: number;
        name: {
          full: string | null;
          native: string | null;
        } | null;
        image: {
          large: string | null;
        } | null;
      } | null;
      voiceActors: Array<{
        id: number;
        name: {
          full: string | null;
        } | null;
        image: {
          large: string | null;
        } | null;
        languageV2: string | null;
      }> | null;
    }> | null;
  } | null;
  staff: {
    edges: Array<{
      role: string | null;
      node: {
        id: number;
        name: {
          full: string | null;
        } | null;
        image: {
          large: string | null;
        } | null;
      } | null;
    }> | null;
  } | null;
  relations: {
    edges: Array<{
      relationType: string;
      node: (AniListMedia & { type: string | null }) | null;
    }> | null;
  } | null;
  recommendations: {
    nodes: Array<{
      mediaRecommendation: AniListMedia | null;
    }> | null;
  } | null;
};

export function transformAnimeSummary(media: Partial<AniListMedia>): AnimeSummary {
  const m = media;
  const isFinished = m.status === "FINISHED";
  const isReleasing = m.status === "RELEASING";

  let airingCount = 0;
  if (isFinished) {
    airingCount = m.episodes ?? 0;
  } else if (isReleasing) {
    airingCount = m.nextAiringEpisode
      ? Math.max(0, m.nextAiringEpisode.episode - 1)
      : 0;
  }

  // AniList carries no dub information. Real dub counts come from the
  // AnimeSchedule dub timetable where available; null means "unknown",
  // never a fabricated guess.
  const dubCount: number | null = null;

  return {
    id: m.id ?? 0,
    idMal: m.idMal ?? null,
    title: {
      romaji: m.title?.romaji ?? null,
      english: m.title?.english ?? null,
      native: m.title?.native ?? null,
      userPreferred: m.title?.userPreferred ?? null,
    },
    coverImage: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    bannerImage: m.bannerImage ?? null,
    color: m.coverImage?.color ?? null,
    format: m.format ?? null,
    status: m.status ?? null,
    source: m.source ?? null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    season: m.season ?? null,
    seasonYear: m.seasonYear ?? null,
    startDate: m.startDate ?? null,
    averageScore: m.averageScore ?? null,
    meanScore: m.meanScore ?? null,
    popularity: m.popularity ?? null,
    trending: m.trending ?? null,
    favourites: m.favourites ?? null,
    genres: m.genres ?? [],
    studios: m.studios?.nodes ?? [],
    nextAiringEpisode: m.nextAiringEpisode ?? null,
    description: m.description ?? null,
    airingCount,
    dubCount,
  };
}

export function transformCharacterCredits(
  media: AniListDetailsMedia,
): CharacterCredit[] {
  return (
    media.characters?.edges
      ?.filter((edge) => edge.node?.name?.full)
      .map((edge) => {
        const toVoiceActorCredit = (
          actor: {
            id: number;
            name: {
              full: string | null;
            } | null;
            image: {
              large: string | null;
            } | null;
          } | null,
        ): VoiceActorCredit | null =>
          actor
            ? {
                id: actor.id,
                name: actor.name?.full || "Unknown voice actor",
                image: actor.image?.large || null,
              }
            : null;

        const japaneseActor =
          edge.voiceActors?.find(
            (va) => va.languageV2 === "Japanese" && va.name?.full,
          ) || null;
        const englishActor =
          edge.voiceActors?.find(
            (va) => va.languageV2 === "English" && va.name?.full,
          ) || null;

        return {
          id: edge.node?.id || 0,
          name: edge.node?.name?.full || "Unknown character",
          nativeName: edge.node?.name?.native || null,
          image: edge.node?.image?.large || null,
          role: edge.role || null,
          voiceActors: {
            japanese: toVoiceActorCredit(japaneseActor),
            english: toVoiceActorCredit(englishActor),
          },
        };
      }) || []
  );
}

export function transformStaffCredits(media: AniListDetailsMedia): StaffCredit[] {
  return (
    media.staff?.edges
      ?.filter((edge) => edge.node?.name?.full)
      .map((edge) => ({
        id: edge.node?.id || 0,
        name: edge.node?.name?.full || "Unknown staff",
        role: edge.role || "Staff",
        image: edge.node?.image?.large || null,
      })) || []
  );
}

export function transformRelations(media: AniListDetailsMedia): RelationItem[] {
  return (
    media.relations?.edges
      ?.filter((edge) => edge.node?.type === "ANIME")
      .map((edge) => ({
        relationType: edge.relationType,
        anime: transformAnimeSummary(edge.node as AniListMedia),
      })) || []
  );
}

export function transformAnimeDetails(media: AniListDetailsMedia): AnimeDetails {
  return {
    ...transformAnimeSummary(media),
    description: cleanDescription(media.description),
    source: media.source ?? null,
    countryOfOrigin: media.countryOfOrigin ?? null,
    hashtag: media.hashtag ?? null,
    synonyms: media.synonyms ?? [],
    startDate: media.startDate ?? null,
    endDate: media.endDate ?? null,
    streamingEpisodes:
      media.streamingEpisodes?.map((ep) => {
        const match = ep.title?.match(/Episode\s+(\d+)/i);
        return {
          ...ep,
          number: match ? parseInt(match[1], 10) : 0,
        };
      }) || [],
    trailer: media.trailer ?? null,
    tags:
      media.tags
        ?.filter((tag) => !tag.isGeneralSpoiler && !tag.isMediaSpoiler)
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 100)
        .map((tag) => tag.name) || [],
    rankings:
      media.rankings
        ?.slice(0, 4)
        .map((ranking) => `#${ranking.rank} ${ranking.context}`) || [],
    characters: transformCharacterCredits(media),
    staff: transformStaffCredits(media),
    relations: transformRelations(media),
    recommendations:
      media.recommendations?.nodes
        ?.map((node) => node.mediaRecommendation)
        .filter((node): node is AniListMedia => Boolean(node))
        .map(transformAnimeSummary) || [],
    externalLinks: media.externalLinks || [],
  };
}
