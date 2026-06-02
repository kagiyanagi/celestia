import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnimeDetailsShell } from "@/components/anime-details-shell";
import { HeaderImageSetter } from "@/components/header-image-setter";
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
      <HeaderImageSetter image={anime.bannerImage || anime.coverImage} />
      <AnimeDetailsShell anime={anime} watchHref={watchHref} />
    </div>
  );
}
