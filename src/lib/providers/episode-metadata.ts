import { getAniZipData } from "@/lib/providers/anizip";
import { getKitsuEpisodeStills, type KitsuEpisode } from "@/lib/providers/kitsu";
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

const TVDB_EPISODE_SOURCE: EpisodeMetadataSource = {
  provider: "tvdb",
  label: "TheTVDB",
  confidence: "medium",
  fields: [],
};

const KITSU_SOURCE_SUMMARY: MetadataSourceSummary = {
  provider: "kitsu",
  label: "Kitsu",
  role: "image_metadata",
  confidence: "medium",
};

const KITSU_EPISODE_SOURCE: EpisodeMetadataSource = {
  provider: "kitsu",
  label: "Kitsu",
  confidence: "medium",
  fields: ["thumbnail"],
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
    // ani.zip's TVDB still is keyed by AniList episode number and is therefore
    // season-correct; prefer it over AniList's streamingEpisodes thumbnail,
    // which for sequels is often a stale franchise/previous-season image.
    thumbnail: candidate.thumbnail || existing.thumbnail || null,
    url: existing.url || candidate.url || null,
    site: existing.site || candidate.site || null,
    description: candidate.description || existing.description || null,
    airDate: existing.airDate || candidate.airDate || null,
    airDateTime: existing.airDateTime || candidate.airDateTime || null,
    rating: existing.rating ?? candidate.rating ?? null,
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

  if (providers.has("kitsu")) {
    summaries.push(KITSU_SOURCE_SUMMARY);
  }

  return summaries;
}

function normalizeTitleForCompare(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Confirms Kitsu's episode numbering lines up with the catalog before we trust
 * its stills. ani.zip already maps the precise per-entry `kitsu_id`, so this is
 * a safety net for the rare bad mapping, not the primary defense: we compare
 * overlapping episodes by air date (most robust) or title, and require a
 * majority to agree. With no comparable overlap we trust the mapping.
 */
function isKitsuAligned(
  kitsuEpisodes: KitsuEpisode[],
  episodeMap: Map<number, AnimeStreamingEpisode>,
): boolean {
  let comparable = 0;
  let matched = 0;

  for (const kitsuEpisode of kitsuEpisodes) {
    const existing = episodeMap.get(kitsuEpisode.number);
    if (!existing) continue;

    if (kitsuEpisode.airDate && existing.airDate) {
      comparable += 1;
      if (kitsuEpisode.airDate === existing.airDate) matched += 1;
      continue;
    }

    const kitsuTitle = normalizeTitleForCompare(kitsuEpisode.title);
    const existingTitle = normalizeTitleForCompare(existing.title);
    const generic =
      isGenericEpisodeTitle(kitsuEpisode.title, kitsuEpisode.number) ||
      isGenericEpisodeTitle(existing.title, existing.number);

    if (kitsuTitle && existingTitle && !generic) {
      comparable += 1;
      if (
        kitsuTitle === existingTitle ||
        kitsuTitle.includes(existingTitle) ||
        existingTitle.includes(kitsuTitle)
      ) {
        matched += 1;
      }
    }
  }

  if (comparable === 0) return true;
  return matched / comparable >= 0.5;
}

/**
 * Fills still-less episodes with Kitsu thumbnails. Existing stills (TVDB via
 * ani.zip, or AniList's streaming thumbnails) always win — Kitsu only fills
 * gaps — and the thumbnail is attributed to Kitsu for source transparency.
 */
function fillFromKitsu(
  episodeMap: Map<number, AnimeStreamingEpisode>,
  kitsuEpisodes: KitsuEpisode[],
): void {
  if (!kitsuEpisodes.length || !isKitsuAligned(kitsuEpisodes, episodeMap)) {
    return;
  }

  for (const kitsuEpisode of kitsuEpisodes) {
    if (!kitsuEpisode.thumbnail) continue;

    const existing = episodeMap.get(kitsuEpisode.number);
    if (!existing || existing.thumbnail) continue;

    episodeMap.set(kitsuEpisode.number, {
      ...existing,
      thumbnail: kitsuEpisode.thumbnail,
      sources: mergeSources(existing.sources, [KITSU_EPISODE_SOURCE]),
    });
  }
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

  // Episode stills come from ani.zip (TVDB) and AniList first, both keyed by
  // AniList episode number and therefore season-correct. Kitsu fills the gaps
  // they leave (long-running shows like One Piece have TVDB stills for only
  // the first cour): it is reached via ani.zip's per-entry `kitsu_id`, so its
  // numbering aligns with this exact catalog entry — unlike TMDB, which models
  // a franchise as one show with absolute numbering and would stamp an earlier
  // season's images onto later seasons. Alignment is still verified before any
  // Kitsu still is trusted, and Kitsu only fills genuinely empty slots. We
  // deliberately never reach for TMDB stills here (accuracy over fabrication).
  const stillLessNumbers = Array.from(episodeMap.values())
    .filter((episode) => !episode.thumbnail)
    .map((episode) => episode.number);
  const kitsuId = aniZipData?.mappings.kitsuId ?? null;

  if (stillLessNumbers.length && kitsuId) {
    const kitsuEpisodes = await getKitsuEpisodeStills(kitsuId, {
      maxNumber: Math.max(...stillLessNumbers),
    });
    fillFromKitsu(episodeMap, kitsuEpisodes);
  }

  const episodes = Array.from(episodeMap.values()).sort(
    (first, second) => first.number - second.number,
  );

  return {
    episodes,
    sources: collectSourceSummaries(episodes),
  };
}
