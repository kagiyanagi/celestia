"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown01,
  ArrowDown10,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Play,
  Radio,
  RotateCcw,
  Share2,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { getDisplayTitle, getSecondaryTitle } from "@/lib/format";
import type { AnimeDetails, AnimeDate } from "@/types/anime";

type AnimeDetailsShellProps = {
  anime: AnimeDetails;
  watchHref: string;
};

type TabKey = "overview" | "characters" | "episodes" | "related" | "similar";

function formatDate(date: AnimeDate | null): string {
  if (!date || (!date.year && !date.month && !date.day)) return "?";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const m = date.month ? months[date.month - 1] : "";
  return [m, date.day, date.year].filter(Boolean).join(" ");
}

export function AnimeDetailsShell({
  anime,
  watchHref,
}: AnimeDetailsShellProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [epPage, setEpPage] = useState(1);
  const [epOrder, setEpOrder] = useState<"asc" | "desc">("asc");
  const EP_PER_PAGE = 47;

  const title = getDisplayTitle(anime.title);
  const secondaryTitle = getSecondaryTitle(anime.title);

  const relatedItems = anime.relations.filter((item) =>
    [
      "PREQUEL",
      "SEQUEL",
      "SOURCE",
      "SIDE_STORY",
      "SUMMARY",
      "PARENT",
      "SPIN_OFF",
    ].includes(item.relationType),
  );

  return (
    <div className="anime-details-shell">
      <section className="anime-hero-stage">
        {anime.bannerImage ? (
          <Image
            src={anime.bannerImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="detail-backdrop"
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
              {anime.status === "NOT_YET_RELEASED" ? (
                <div className="hero-watch-btn disabled">
                  <Play size={18} fill="currentColor" />
                  Not Yet Released
                </div>
              ) : (
                <Link className="hero-watch-btn" href={watchHref}>
                  <Play size={18} fill="currentColor" />
                  Watch Now
                </Link>
              )}
              <button className="hero-icon-btn" title="Add to list">
                <Bookmark size={20} />
              </button>
              <button className="hero-icon-btn" title="Share">
                <Share2 size={20} />
              </button>
              <a
                href={`https://anilist.co/anime/${anime.id}`}
                target="_blank"
                rel="noreferrer"
                className="hero-db-btn"
              >
                AL
              </a>
              {anime.idMal && (
                <a
                  href={`https://myanimelist.net/anime/${anime.idMal}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hero-db-btn"
                >
                  MAL
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
            <p className="hero-synopsis">{anime.description}</p>
          </div>
        </div>
      </section>

      <nav className="anime-tabs-nav">
        {(
          [
            "overview",
            "characters",
            "episodes",
            "related",
            "similar",
          ] as TabKey[]
        ).map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "similar"
              ? "More like this"
              : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {activeTab === "overview" && (
          <div className="tab-overview">
            {anime.status === "RELEASING" && anime.nextAiringEpisode && (
              <div className="airing-banner">
                <Clock size={16} />
                Next ep airing{" "}
                <span className="highlight">
                  in{" "}
                  {Math.floor(anime.nextAiringEpisode.timeUntilAiring / 86400)}{" "}
                  days
                </span>
              </div>
            )}

            <div className="overview-stats-grid">
              <div className="stat-box">
                <span className="stat-label">Average Score</span>
                <strong className="stat-value">
                  {anime.averageScore
                    ? (anime.averageScore / 10).toFixed(1)
                    : "?"}
                </strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">Type</span>
                <strong className="stat-value">{anime.format || "TV"}</strong>
              </div>
              <div className="stat-box">
                <span className="stat-label">Duration</span>
                <strong className="stat-value">
                  {anime.duration ? `${anime.duration} min` : "?"}
                </strong>
              </div>
            </div>

            <div className="fact-list-container">
              <div className="fact-item">
                <span>Start:</span>
                <strong>{formatDate(anime.startDate)}</strong>
              </div>
              <div className="fact-item">
                <span>End:</span>
                <strong>{formatDate(anime.endDate)}</strong>
              </div>
              <div className="fact-item">
                <span>Season:</span>
                <strong className="uppercase">
                  {anime.season} {anime.seasonYear}
                </strong>
              </div>
              <div className="fact-item">
                <span>Status:</span>
                <strong
                  className={anime.status === "RELEASING" ? "text-green" : ""}
                >
                  {anime.status?.replaceAll("_", " ")}
                </strong>
              </div>
              <div className="fact-item">
                <span>Mean Score:</span>
                <strong>{anime.meanScore || "?"}</strong>
              </div>
              <div className="fact-item">
                <span>Source:</span>
                <strong>{anime.source?.replaceAll("_", " ")}</strong>
              </div>
              <div className="fact-item">
                <span>Country:</span>
                <strong>{anime.countryOfOrigin}</strong>
              </div>
              <div className="fact-item">
                <span>Hashtag:</span>
                <strong>{anime.hashtag}</strong>
              </div>
              <div className="fact-item">
                <span>Native Title:</span>
                <strong>{anime.title.native}</strong>
              </div>
              {anime.synonyms.length > 0 && (
                <div className="fact-item">
                  <span>Synonyms:</span>
                  <strong>{anime.synonyms.join(", ")}</strong>
                </div>
              )}
            </div>

            {anime.trailer && (
              <div className="trailer-section">
                <h2>Trailer</h2>
                <div className="trailer-embed">
                  {anime.trailer.site === "youtube" ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${anime.trailer.id}`}
                      title="Trailer"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <a
                      href={anime.trailer.id || ""}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Watch Trailer
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="meta-section">
              <h2>Studios</h2>
              <div className="meta-pills-row">
                {anime.studios.map((s) => (
                  <span key={s.id} className="meta-pill">
                    {s.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="meta-section">
              <h2>Genres</h2>
              <div className="meta-pills-row">
                {anime.genres.map((g) => (
                  <span key={g} className="meta-pill">
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <div className="meta-section">
              <h2>Tags</h2>
              <div className="meta-pills-row">
                {anime.tags.map((t) => (
                  <span key={t} className="meta-pill">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="cast-section">
              <div className="section-header-row">
                <h2>Characters</h2>
                <button
                  className="show-more"
                  type="button"
                  onClick={() => setActiveTab("characters")}
                >
                  Show more
                </button>
              </div>
              <div className="cast-grid">
                {anime.characters.slice(0, 12).map((char) => (
                  <div className="cast-card" key={char.id}>
                    <div className="cast-image-pair">
                      <div className="char-img">
                        {char.image && (
                          <Image
                            src={char.image}
                            alt={char.name}
                            fill
                            sizes="60px"
                          />
                        )}
                      </div>
                      <div className="va-img">
                        {char.voiceActors.japanese?.image && (
                          <Image
                            src={char.voiceActors.japanese.image}
                            alt={char.voiceActors.japanese.name}
                            fill
                            sizes="60px"
                          />
                        )}
                      </div>
                    </div>
                    <div className="cast-info">
                      <div className="cast-main">
                        <div className="char-name">
                          <strong>{char.name}</strong>
                          <span>{char.role}</span>
                        </div>
                      </div>
                      <div className="va-name">
                        <strong>
                          {char.voiceActors.japanese?.name || "No JP VA"}
                        </strong>
                        <span>Japanese</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="staff-section">
              <h2>Staff</h2>
              <div className="staff-grid">
                {anime.staff.map((s) => (
                  <div className="staff-card" key={`${s.id}-${s.role}`}>
                    <div className="staff-img">
                      {s.image && (
                        <Image src={s.image} alt={s.name} fill sizes="100px" />
                      )}
                    </div>
                    <div className="staff-info">
                      <span className="staff-role">{s.role}</span>
                      <strong className="staff-name">{s.name}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "characters" && (
          <div className="tab-characters">
            <div className="section-header-row">
              <h2>Characters</h2>
              <span className="characters-count">
                {anime.characters.length} total
              </span>
            </div>

            <div className="character-tab-grid">
              {anime.characters.map((char) => (
                <article className="character-tab-card" key={char.id}>
                  <div className="character-tab-top">
                    <div className="character-tab-image">
                      {char.image ? (
                        <Image
                          src={char.image}
                          alt={char.name}
                          fill
                          sizes="96px"
                        />
                      ) : null}
                    </div>

                    <div className="character-tab-copy">
                      <h3>{char.name}</h3>
                      {char.nativeName ? <p>{char.nativeName}</p> : null}
                      <span>{char.role || "Character"}</span>
                    </div>
                  </div>

                  <div className="voice-actor-stack">
                    <div className="voice-actor-row">
                      <div className="voice-actor-avatar">
                        {char.voiceActors.japanese?.image ? (
                          <Image
                            src={char.voiceActors.japanese.image}
                            alt={char.voiceActors.japanese.name}
                            fill
                            sizes="56px"
                          />
                        ) : null}
                      </div>
                      <div className="voice-actor-copy">
                        <strong>
                          {char.voiceActors.japanese?.name || "Not listed"}
                        </strong>
                        <span>Japanese VA</span>
                      </div>
                    </div>

                    <div className="voice-actor-row">
                      <div className="voice-actor-avatar">
                        {char.voiceActors.english?.image ? (
                          <Image
                            src={char.voiceActors.english.image}
                            alt={char.voiceActors.english.name}
                            fill
                            sizes="56px"
                          />
                        ) : null}
                      </div>
                      <div className="voice-actor-copy">
                        <strong>
                          {char.voiceActors.english?.name || "Not listed"}
                        </strong>
                        <span>English VA</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeTab === "episodes" && (
          <div className="tab-episodes">
            {(() => {
              const totalEpisodes =
                anime.streamingEpisodes.length > 0
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
                epOrder === "asc"
                  ? totalEpisodes
                  : [...totalEpisodes].reverse();

              const paged = sorted.slice(
                (epPage - 1) * EP_PER_PAGE,
                epPage * EP_PER_PAGE,
              );

              const rangeLabel =
                paged.length > 0
                  ? `${paged[0].number} - ${paged[paged.length - 1].number}`
                  : "0 - 0";

              const totalPages = Math.ceil(totalEpisodes.length / EP_PER_PAGE);

              return (
                <>
                  <div className="episodes-header-modern">
                    <div className="ep-header-left">
                      <div className="ep-count-pill">
                        {totalEpisodes.length} Episodes
                      </div>
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
                          onClick={() =>
                            setEpPage((p) => Math.min(totalPages, p + 1))
                          }
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
                        title={
                          epOrder === "asc"
                            ? "Sort Descending"
                            : "Sort Ascending"
                        }
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
                </>
              );
            })()}
          </div>
        )}

        {activeTab === "related" && (
          <div className="tab-relations">
            <div className="relations-grid">
              {relatedItems.map((rel) => (
                <Link
                  key={rel.anime.id}
                  href={`/anime/${rel.anime.id}`}
                  className="relation-card-wide"
                >
                  <div className="rel-poster">
                    {rel.anime.coverImage && (
                      <Image
                        src={rel.anime.coverImage}
                        alt={getDisplayTitle(rel.anime.title)}
                        fill
                        sizes="80px"
                      />
                    )}
                  </div>
                  <div className="rel-info">
                    <span className="rel-type">
                      {rel.relationType.replaceAll("_", " ")}
                    </span>
                    <strong className="rel-title">
                      {getDisplayTitle(rel.anime.title)}
                    </strong>
                    <span className="rel-meta">
                      {rel.anime.format} • {rel.anime.season}{" "}
                      {rel.anime.seasonYear}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === "similar" && (
          <div className="tab-similar">
            <div className="relations-grid">
              {anime.recommendations.map((rec) => (
                <Link
                  key={rec.id}
                  href={`/anime/${rec.id}`}
                  className="relation-card-wide"
                >
                  <div className="rel-poster">
                    {rec.coverImage && (
                      <Image
                        src={rec.coverImage}
                        alt={getDisplayTitle(rec.title)}
                        fill
                        sizes="80px"
                      />
                    )}
                  </div>
                  <div className="rel-info">
                    <strong className="rel-title">
                      {getDisplayTitle(rec.title)}
                    </strong>
                    <span className="rel-meta">
                      {rec.format} • {rec.season} {rec.seasonYear}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
