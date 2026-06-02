import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";

import { formatSeasonLabel } from "@/lib/anime-season";
import {
  cleanDescription,
  formatRelativeSeconds,
  getDisplayTitle,
} from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type HomeUpcomingGridProps = {
  items: AnimeSummary[];
};

export function HomeUpcomingGrid({ items }: HomeUpcomingGridProps) {
  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2>Top Upcoming</h2>
        <Link href="/upcoming">
          View all
          <ArrowRight size={18} aria-hidden />
        </Link>
      </div>

      <div className="upcoming-rail">
        {items.map((anime) => {
          const title = getDisplayTitle(anime.title);
          const studio = anime.studios?.[0]?.name;
          const themeColor = anime.color || "rgba(255, 255, 255, 0.1)";

          const countdown = anime.nextAiringEpisode
            ? formatRelativeSeconds(
                anime.nextAiringEpisode.timeUntilAiring,
              ).replace("in ", "")
            : anime.season && anime.seasonYear
              ? formatSeasonLabel(anime.season, anime.seasonYear)
              : anime.seasonYear || "Soon";

          return (
            <Link
              className="upcoming-card-wide"
              href={`/anime/${anime.id}`}
              key={anime.id}
              style={{ "--theme-color": themeColor } as React.CSSProperties}
            >
              <div className="upcoming-card-left">
                {anime.coverImage ? (
                  <Image
                    src={anime.coverImage}
                    alt=""
                    fill
                    sizes="200px"
                    className="poster-image"
                    loading="lazy"
                  />
                ) : null}
                <div className="upcoming-card-poster-info">
                  {anime.coverImage ? (
                    <Image
                      src={anime.coverImage}
                      alt=""
                      fill
                      sizes="180px"
                      className="upcoming-card-poster-blur"
                      loading="lazy"
                    />
                  ) : null}
                  <strong className="upcoming-card-title">
                    {anime.status === "RELEASING" && (
                      <Radio
                        size={14}
                        className="upcoming-card-airing-icon"
                        aria-hidden
                      />
                    )}
                    {title}
                  </strong>
                  {studio ? (
                    <span className="upcoming-card-studio">{studio}</span>
                  ) : null}
                </div>
              </div>

              <div className="upcoming-card-right">
                <div className="upcoming-card-top">
                  <span className="upcoming-kicker">Ep 1 airing in</span>
                  <span className="upcoming-countdown">{countdown}</span>
                  <span className="upcoming-source">
                    Source : {anime.source?.replaceAll("_", " ") || "Original"}
                  </span>
                </div>

                <p className="upcoming-card-desc">
                  {cleanDescription(anime.description) ||
                    "A new anime worth keeping an eye on."}
                </p>

                <div className="upcoming-card-tags">
                  {(anime.genres ?? []).slice(0, 2).map((genre) => (
                    <span
                      key={genre}
                      style={{
                        backgroundColor: themeColor + "33",
                        color: themeColor,
                      }}
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
