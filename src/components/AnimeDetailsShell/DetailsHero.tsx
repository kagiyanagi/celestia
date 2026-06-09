import Image from "next/image";
import { Radio } from "lucide-react";
import { DetailsSaveButton } from "@/components/details-save-button";
import { DetailsFavoriteButton } from "@/components/details-favorite-button";
import { AnimeDetails } from "@/types/anime";
import { DetailsShareButton } from "./DetailsShareButton";
import { DetailsWatchButton } from "./DetailsWatchButton";
import { DetailsTrackingBar } from "./DetailsTrackingBar";
import { DetailsSynopsis } from "./DetailsSynopsis";

interface DetailsHeroProps {
  anime: AnimeDetails;
  watchHref: string;
  title: string;
  secondaryTitle: string | null;
}

export function DetailsHero({
  anime,
  watchHref,
  title,
  secondaryTitle,
}: DetailsHeroProps) {
  const backdropImage = anime.bannerImage || anime.coverImage;

  return (
    <section className="anime-hero-stage">
      {backdropImage ? (
        <Image
          src={backdropImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className={
            anime.bannerImage ? "detail-backdrop" : "detail-backdrop is-cover"
          }
        />
      ) : null}
      <div className="detail-scrim" />

      <div className="anime-hero-new">
        <div className="hero-poster-col">
          <div className="hero-poster-wrap">
            {anime.coverImage ? (
              <Image
                src={anime.coverImage}
                alt={title}
                fill
                priority
                sizes="300px"
              />
            ) : (
              <div className="poster-placeholder">CELESTIA</div>
            )}
          </div>
          <div className="hero-actions-row">
            <DetailsWatchButton anime={anime} watchHref={watchHref} />
            <DetailsSaveButton anime={anime} />
            <DetailsFavoriteButton anime={anime} />
          </div>
          <DetailsTrackingBar anime={anime} />
          <div className="hero-actions-row hero-links-row">
            <DetailsShareButton title={title} />
            <a
              href={`https://anilist.co/anime/${anime.id}`}
              target="_blank"
              rel="noreferrer"
              className="hero-db-btn"
            >
              AniList
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://anilist.co/img/icons/favicon-32x32.png"
                alt=""
                width={16}
                height={16}
              />
            </a>
            {anime.idMal && (
              <a
                href={`https://myanimelist.net/anime/${anime.idMal}`}
                target="_blank"
                rel="noreferrer"
                className="hero-db-btn"
              >
                MAL
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://cdn.myanimelist.net/images/favicon.ico"
                  alt=""
                  width={16}
                  height={16}
                />
              </a>
            )}
          </div>
        </div>

        <div className="hero-info-col">
          <div className="hero-status-badges">
            {anime.status === "RELEASING" && (
              <span className="badge-airing">
                <Radio size={14} />
                AIRING
              </span>
            )}
          </div>
          <h1 className="hero-title">{title}</h1>
          {secondaryTitle ? (
            <p className="hero-secondary-title">{secondaryTitle}</p>
          ) : null}
          <div className="hero-meta-pills">
            <span className="pill-orange">{anime.format || "Anime"}</span>
            {anime.season && (
              <span className="pill-orange">{anime.season}</span>
            )}
            {anime.seasonYear && (
              <span className="pill-orange">{anime.seasonYear}</span>
            )}
            {anime.status ? (
              <span className="pill-orange">
                {anime.status.replaceAll("_", " ")}
              </span>
            ) : null}
          </div>
          {anime.description ? (
            <DetailsSynopsis description={anime.description} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
