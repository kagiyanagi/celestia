import {
  EpisodeBrowser,
  type BrowserEpisode,
} from "@/components/episode-browser";
import { CLIENT_EPISODE_CAP } from "@/lib/episode-pagination";
import { AnimeDetails } from "@/types/anime";

interface DetailsEpisodesProps {
  anime: AnimeDetails;
  watchHref: string;
  /** Real episode count when the list was trimmed from the payload upstream. */
  episodeTotal?: number;
}

export function DetailsEpisodes({
  anime,
  watchHref,
  episodeTotal,
}: DetailsEpisodesProps) {
  // Mega-shows (1000+ eps) have their episode list stripped from the page
  // payload upstream; `episodeTotal` carries the real count and the browser
  // pages/searches via the API. Don't synthesize a list in that case.
  const total = episodeTotal ?? anime.streamingEpisodes?.length ?? 0;
  const paginated = total > CLIENT_EPISODE_CAP;

  const allEpisodes: BrowserEpisode[] = paginated
    ? []
    : anime.streamingEpisodes && anime.streamingEpisodes.length > 0
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
      paginated={paginated}
      totalEpisodes={total}
      watchQuery={{
        sid: watchSearch.get("sid"),
        server: watchSearch.get("server"),
      }}
    />
  );
}
