import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  RotateCcw,
  ArrowDown01,
  ArrowDown10,
} from "lucide-react";
import { AnimeDetails } from "@/types/anime";

interface DetailsEpisodesProps {
  anime: AnimeDetails;
  watchHref: string;
}

export function DetailsEpisodes({ anime, watchHref }: DetailsEpisodesProps) {
  const router = useRouter();
  const [epPage, setEpPage] = useState(1);
  const [epOrder, setEpOrder] = useState<"asc" | "desc">("asc");
  const EP_PER_PAGE = 47;

  const totalEpisodes =
    anime.streamingEpisodes && anime.streamingEpisodes.length > 0
      ? anime.streamingEpisodes.slice(
          0,
          anime.airingCount || anime.streamingEpisodes.length,
        )
      : Array.from({ length: anime.airingCount || 0 }, (_, i) => ({
          number: i + 1,
          title: `Episode ${i + 1}`,
          thumbnail: anime.bannerImage,
          description:
            "Official episode data is not yet available for this title.",
          site: null,
          url: null,
        }));

  const sorted =
    epOrder === "asc" ? totalEpisodes : [...totalEpisodes].reverse();

  const paged = sorted.slice((epPage - 1) * EP_PER_PAGE, epPage * EP_PER_PAGE);

  const rangeLabel =
    paged.length > 0
      ? `${paged[0].number} - ${paged[paged.length - 1].number}`
      : "0 - 0";

  const totalPages = Math.ceil(totalEpisodes.length / EP_PER_PAGE);

  return (
    <div className="tab-episodes">
      <div className="episodes-header-modern">
        <div className="ep-header-left">
          <div className="ep-count-pill">{totalEpisodes.length} Episodes</div>
          <div className="ep-pagination-modern">
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage(1)}
              disabled={epPage === 1}
              title="First Page"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage((p) => Math.max(1, p - 1))}
              disabled={epPage === 1}
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="ep-range-pill">{rangeLabel}</div>
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage((p) => Math.min(totalPages, p + 1))}
              disabled={epPage >= totalPages}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="ep-nav-btn"
              onClick={() => setEpPage(totalPages)}
              disabled={epPage >= totalPages}
              title="Last Page"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>

        <div className="ep-header-right">
          <button
            className="ep-action-btn"
            onClick={() => router.refresh()}
            title="Refresh data"
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="ep-action-btn"
            onClick={() => {
              setEpOrder((o) => (o === "asc" ? "desc" : "asc"));
              setEpPage(1);
            }}
            title={epOrder === "asc" ? "Sort Descending" : "Sort Ascending"}
          >
            {epOrder === "asc" ? (
              <ArrowDown01 size={18} />
            ) : (
              <ArrowDown10 size={18} />
            )}
          </button>
        </div>
      </div>

      <div className="episode-grid-new">
        {paged.map((ep) => (
          <Link
            key={ep.number}
            href={`${watchHref.split("?")[0]}?ep=${ep.number}${watchHref.includes("sid=") ? `&sid=${watchHref.split("sid=")[1]}` : ""}`}
            className="episode-card-new"
          >
            <div className="ep-thumb">
              {ep.thumbnail || anime.bannerImage ? (
                <Image
                  src={ep.thumbnail || anime.bannerImage || ""}
                  alt={ep.title || `Ep ${ep.number}`}
                  fill
                  sizes="300px"
                />
              ) : null}
              <span className="ep-number">Ep {ep.number}</span>
            </div>
            <div className="ep-info">
              <strong>{ep.title || `Episode ${ep.number}`}</strong>
              <p className="ep-description-text">
                {ep.description ||
                  `Watch this episode on ${ep.site || "official providers"}.`}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
