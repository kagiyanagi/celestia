import {
  EpisodeBrowser,
  type BrowserEpisode,
} from "@/components/episode-browser";
import { AnimeDetails } from "@/types/anime";

interface DetailsEpisodesProps {
  anime: AnimeDetails;
  watchHref: string;
}

export function DetailsEpisodes({ anime, watchHref }: DetailsEpisodesProps) {
  // The full episode list ships in the payload (a few KB gzipped even for
  // 1000+ episode shows) so thumbnails render instantly and search/paging stay
  // client-side. When the provider has no episode rows, synthesize the count.
  const allEpisodes: BrowserEpisode[] =
    anime.streamingEpisodes && anime.streamingEpisodes.length > 0
      ? anime.streamingEpisodes
          .slice(0, anime.airingCount || anime.streamingEpisodes.length)
          .map((ep) => ({
            number: ep.number,
            title: ep.title || null,
            description: ep.description || null,
            thumbnail: ep.thumbnail || null,
            airDate: ep.airDate || null,
            rating: ep.rating ?? null,
          }))
      : Array.from({ length: anime.airingCount || 0 }, (_, i) => ({
          number: i + 1,
          title: `Episode ${i + 1}`,
          description:
            "Official episode data is not yet available for this title.",
          thumbnail: null,
          airDate: null,
          rating: null,
        }));

  // Reuse the resolved stream params from the page's watch link.
  const watchSearch = new URLSearchParams(watchHref.split("?")[1] || "");

  return (
    <EpisodeBrowser
      anime={anime}
      episodes={allEpisodes}
      watchQuery={{
        sid: watchSearch.get("sid"),
        server: watchSearch.get("server"),
      }}
    />
  );
}
