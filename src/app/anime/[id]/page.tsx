import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnimeDetailsShell } from "@/components/AnimeDetailsShell";
import { HeaderImageSetter } from "@/components/header-image-setter";
import { ScrollToTop } from "@/components/scroll-to-top";
import { getDisplayTitle } from "@/lib/format";
import { getAnimeDetails } from "@/lib/providers/anilist";
import { buildWatchHref } from "@/lib/watch-href";

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

  // The watch page resolves the stream source itself on first render, so the
  // details page no longer blocks on a streaming title-guess probe just to
  // prefill the href — that previously cost up to 4s of TTFB. Link straight to
  // episode 1 and let the watch page (and its in-place switcher) resolve.
  const watchHref = buildWatchHref({ animeId: anime.id, episode: 1 });

  return (
    <div className="detail-page">
      <ScrollToTop />
      <HeaderImageSetter image={anime.bannerImage || anime.coverImage} />
      <AnimeDetailsShell anime={anime} watchHref={watchHref} />
    </div>
  );
}
