import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnimeDetailsShell } from "@/components/AnimeDetailsShell";
import { HeaderImageSetter } from "@/components/header-image-setter";
import { ScrollToTop } from "@/components/scroll-to-top";
import { withSoftTimeout } from "@/lib/async";
import { getDisplayTitle } from "@/lib/format";
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
  const streamLookupTitle = [
    anime.title?.romaji,
    anime.title?.english,
    anime.title?.userPreferred,
    title,
    ...(anime.synonyms || []),
  ].filter((value): value is string => Boolean(value));
  // The details page only needs availability to prefill the watch href —
  // never hold the render hostage to a slow provider probe. The watch page
  // re-resolves the source itself.
  const streamAvailability = await withSoftTimeout(
    findStreamAvailability(
      streamLookupTitle,
      anime.episodes ?? anime.airingCount ?? null,
      null,
      anime.id,
    ),
    4_000,
    {
      available: false,
      providerId: null,
      provider: "unknown",
      providerAnimeId: null,
      episodeCount: null,
    },
  );
  const watchParams = new URLSearchParams({ ep: "1" });

  if (streamAvailability.providerAnimeId) {
    watchParams.set("sid", String(streamAvailability.providerAnimeId));
  }

  if (streamAvailability.providerId) {
    watchParams.set("server", streamAvailability.providerId);
  }

  const watchHref = `/watch/${anime.id}?${watchParams.toString()}`;

  return (
    <div className="detail-page">
      <ScrollToTop />
      <HeaderImageSetter image={anime.bannerImage || anime.coverImage} />
      <AnimeDetailsShell anime={anime} watchHref={watchHref} />
    </div>
  );
}
