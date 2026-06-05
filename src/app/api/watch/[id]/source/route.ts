import { NextResponse } from "next/server";

import { getAnimeDetails } from "@/lib/providers/anilist";
import { getStreamSource } from "@/lib/providers/streaming";
import { getDisplayTitle } from "@/lib/format";
import type { StreamAudioType } from "@/types/streaming";

function getAudioValue(value: string | null): StreamAudioType | null {
  return value === "sub" || value === "dub" ? value : null;
}

function getProviderAnimeId(value: string | null): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

/**
 * Resolves the stream source for a single server/audio/episode combination so
 * the watch page can swap the player in place instead of reloading the whole
 * route when the viewer switches server or sub/dub. Mirrors the resolution the
 * page does on first render. Public catalog data, no auth.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const animeId = Number(id);

  if (!Number.isInteger(animeId) || animeId <= 0) {
    return NextResponse.json({ error: "Invalid anime id." }, { status: 400 });
  }

  const searchParams = new URL(request.url).searchParams;
  const episode = Math.max(1, Math.floor(Number(searchParams.get("ep")) || 1));
  const server = searchParams.get("server");
  const audio = getAudioValue(searchParams.get("audio"));
  const providerAnimeId = getProviderAnimeId(searchParams.get("sid"));

  const anime = await getAnimeDetails(animeId);

  if (!anime) {
    return NextResponse.json({ error: "Anime not found." }, { status: 404 });
  }

  const streamLookupTitle = [
    anime.title?.romaji,
    anime.title?.english,
    anime.title?.userPreferred,
    getDisplayTitle(anime.title),
    ...(anime.synonyms || []),
  ].filter((value): value is string => Boolean(value));

  try {
    const source = await getStreamSource({
      animeTitle: streamLookupTitle,
      providerAnimeId,
      episode,
      providerId: server,
      audio,
      expectedEpisodes: anime.episodes ?? anime.airingCount ?? null,
      anilistId: anime.id,
    });

    // The player consumes the embed/fallbacks, not the provider episode list;
    // drop it so an in-place switch on a mega-show doesn't ship ~1 MB it ignores.
    return NextResponse.json({
      source: source ? { ...source, episodes: [] } : null,
    });
  } catch (error) {
    console.error("Stream source switch failed", error);
    return NextResponse.json({ source: null });
  }
}
