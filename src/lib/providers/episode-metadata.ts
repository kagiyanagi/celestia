import { getAniZipData } from "@/lib/providers/anizip";
import { getTmdbEpisodeStills, isTmdbConfigured } from "@/lib/providers/tmdb";
import type {
  AnimeStreamingEpisode,
  EpisodeMetadataField,
  EpisodeMetadataSource,
  MetadataSourceSummary,
} from "@/types/anime";

type EpisodeMetadataInput = {
  anilistId: number;
  anilistEpisodes: AnimeStreamingEpisode[];
  /** Total episodes the catalog expects (AniList count or aired count). */
  expectedEpisodes?: number | null;
};

// Below this thumbnail coverage we reach for TMDB stills as a gap-filler.
const TMDB_ENRICHMENT_COVERAGE_THRESHOLD = 0.8;

type EpisodeMetadataResult = {
  episodes: AnimeStreamingEpisode[];
  sources: MetadataSourceSummary[];
};

type SourceDefinition = {
  source: EpisodeMetadataSource;
  summary: MetadataSourceSummary;
};

const ANILIST_SOURCE: SourceDefinition = {
  source: {
    provider: "anilist",
    label: "AniList",
    confidence: "high",
    fields: [],
  },
  summary: {
    provider: "anilist",
    label: "AniList",
    role: "catalog",
    confidence: "high",
  },
};

const ANIZIP_SOURCE: SourceDefinition = {
  source: {
    provider: "anizip",
    label: "AniZip",
    confidence: "medium",
    fields: [],
  },
  summary: {
    provider: "anizip",
    label: "AniZip",
    role: "episode_metadata",
    confidence: "medium",
  },
};

const TVDB_SOURCE: MetadataSourceSummary = {
  provider: "tvdb",
  label: "TheTVDB",
  role: "image_metadata",
  confidence: "medium",
};

const TMDB_SOURCE: SourceDefinition = {
  source: {
    provider: "tmdb",
    label: "TMDB",
    confidence: "medium",
    fields: [],
  },
  summary: {
    provider: "tmdb",
    label: "TMDB",
    role: "image_metadata",
    confidence: "medium",
  },
};

const TVDB_EPISODE_SOURCE: EpisodeMetadataSource = {
  provider: "tvdb",
  label: "TheTVDB",
  confidence: "medium",
  fields: [],
};

function getKnownFields(
  episode: AnimeStreamingEpisode,
): EpisodeMetadataField[] {
  const fields: EpisodeMetadataField[] = [];

  if (episode.title) fields.push("title");
  if (episode.thumbnail) fields.push("thumbnail");
  if (episode.description) fields.push("description");
  if (episode.url) fields.push("url");
  if (episode.site) fields.push("site");

  return fields;
}

function withSource(
  episode: AnimeStreamingEpisode,
  source: EpisodeMetadataSource,
): AnimeStreamingEpisode {
  const fields = getKnownFields(episode);

  return {
    ...episode,
    sources: fields.length
      ? [
          {
            ...source,
            fields,
          },
        ]
      : [],
  };
}

function mergeSources(
  first: EpisodeMetadataSource[] = [],
  second: EpisodeMetadataSource[] = [],
): EpisodeMetadataSource[] {
  const merged = new Map<string, EpisodeMetadataSource>();

  [...first, ...second].forEach((source) => {
    const key = source.provider;
    const existing = merged.get(key);

    merged.set(key, {
      ...source,
      fields: Array.from(
        new Set([...(existing?.fields || []), ...source.fields]),
      ),
    });
  });

  return Array.from(merged.values());
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

function preferEpisodeTitle(
  candidate: string | null | undefined,
  existing: string | null | undefined,
  number: number,
): string | null {
  if (!isGenericEpisodeTitle(candidate, number)) {
    return candidate || null;
  }

  if (!isGenericEpisodeTitle(existing, number)) {
    return existing || null;
  }

  return candidate || existing || null;
}

function mergeEpisode(
  existing: AnimeStreamingEpisode,
  candidate: AnimeStreamingEpisode,
): AnimeStreamingEpisode {
  return {
    number: existing.number,
    title: preferEpisodeTitle(candidate.title, existing.title, existing.number),
    thumbnail: existing.thumbnail || candidate.thumbnail || null,
    url: existing.url || candidate.url || null,
    site: existing.site || candidate.site || null,
    description: candidate.description || existing.description || null,
    sources: mergeSources(existing.sources, candidate.sources),
  };
}

function normalizeEpisodes(
  episodes: AnimeStreamingEpisode[],
  source: EpisodeMetadataSource,
): AnimeStreamingEpisode[] {
  return episodes
    .map((episode, index) => {
      const number =
        Number.isFinite(episode.number) && episode.number > 0
          ? Math.floor(episode.number)
          : index + 1;

      return withSource(
        {
          ...episode,
          number,
        },
        source,
      );
    })
    .filter((episode) => episode.number > 0);
}

function withTvdbSource(
  episode: AnimeStreamingEpisode,
): AnimeStreamingEpisode {
  if (episode.site !== "TVDB") {
    return episode;
  }

  return {
    ...episode,
    sources: mergeSources(episode.sources, [
      {
        ...TVDB_EPISODE_SOURCE,
        fields: getKnownFields(episode),
      },
    ]),
  };
}

function collectSourceSummaries(
  episodes: AnimeStreamingEpisode[],
): MetadataSourceSummary[] {
  const providers = new Set(
    episodes.flatMap((episode) =>
      (episode.sources || []).map((source) => source.provider),
    ),
  );
  const summaries = [ANILIST_SOURCE.summary];

  if (providers.has("anizip")) {
    summaries.push(ANIZIP_SOURCE.summary);
  }

  if (
    providers.has("tvdb") ||
    episodes.some((episode) => episode.site === "TVDB")
  ) {
    summaries.push(TVDB_SOURCE);
  }

  if (providers.has("tmdb")) {
    summaries.push(TMDB_SOURCE.summary);
  }

  return summaries;
}

function getThumbnailCoverage(
  episodeMap: Map<number, AnimeStreamingEpisode>,
  expectedTotal: number,
): number {
  if (!expectedTotal) {
    return 1;
  }

  let withThumbnail = 0;
  episodeMap.forEach((episode) => {
    if (episode.thumbnail) withThumbnail += 1;
  });

  return withThumbnail / expectedTotal;
}

function mergeIntoMap(
  episodeMap: Map<number, AnimeStreamingEpisode>,
  episodes: AnimeStreamingEpisode[],
) {
  episodes.forEach((episode) => {
    const existing = episodeMap.get(episode.number);
    episodeMap.set(
      episode.number,
      existing ? mergeEpisode(existing, episode) : episode,
    );
  });
}

export async function getEpisodeMetadata(
  input: EpisodeMetadataInput,
): Promise<EpisodeMetadataResult> {
  const episodeMap = new Map<number, AnimeStreamingEpisode>();

  normalizeEpisodes(input.anilistEpisodes, ANILIST_SOURCE.source).forEach(
    (episode) => {
      episodeMap.set(episode.number, episode);
    },
  );

  const aniZipData = await getAniZipData(input.anilistId);
  const aniZipEpisodes = normalizeEpisodes(
    aniZipData?.episodes || [],
    ANIZIP_SOURCE.source,
  ).map(withTvdbSource);

  mergeIntoMap(episodeMap, aniZipEpisodes);

  // Long-running series (e.g. One Piece) have sparse TVDB image coverage in
  // ani.zip. When most episodes are missing thumbnails and we know the TMDB
  // show ID, fill the gaps with TMDB stills.
  const expectedTotal = Math.max(
    input.expectedEpisodes || 0,
    aniZipData?.episodeCount || 0,
    episodeMap.size ? Math.max(...episodeMap.keys()) : 0,
  );
  const coverage = getThumbnailCoverage(episodeMap, expectedTotal);
  const tmdbId = aniZipData?.mappings.themoviedbId;

  if (
    isTmdbConfigured() &&
    tmdbId &&
    coverage < TMDB_ENRICHMENT_COVERAGE_THRESHOLD
  ) {
    const tmdbEpisodes = normalizeEpisodes(
      await getTmdbEpisodeStills({
        tmdbId,
        expectedEpisodes: expectedTotal || null,
      }),
      TMDB_SOURCE.source,
    );

    mergeIntoMap(episodeMap, tmdbEpisodes);
  }

  const episodes = Array.from(episodeMap.values()).sort(
    (first, second) => first.number - second.number,
  );

  return {
    episodes,
    sources: collectSourceSummaries(episodes),
  };
}
