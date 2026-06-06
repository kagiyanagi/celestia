import { Clock, Mic } from "lucide-react";
import { AnimeDetails } from "@/types/anime";
import { AiringCountdown } from "@/components/airing-countdown";
import { useAuth } from "@/components/auth-provider";
import { compactNumber, formatAiringTime } from "@/lib/format";
import { formatDate } from "./helpers";
import { DetailsCast } from "./DetailsCast";

interface DetailsOverviewProps {
  anime: AnimeDetails;
  onShowMoreCharacters: () => void;
}

export function DetailsOverview({
  anime,
  onShowMoreCharacters,
}: DetailsOverviewProps) {
  const { user } = useAuth();
  const autoplayTrailer = user?.preferences.autoplayTrailers ?? false;
  return (
    <div className="tab-overview">
      {anime.status === "RELEASING" && anime.nextAiringEpisode && (
        <div className="airing-banner">
          <Clock size={16} />
          Ep {anime.nextAiringEpisode.episode} airing in{" "}
          <span className="highlight">
            <AiringCountdown
              airingAt={anime.nextAiringEpisode.airingAt}
              fallbackSeconds={anime.nextAiringEpisode.timeUntilAiring}
            />
          </span>
          <span className="airing-banner-when" suppressHydrationWarning>
            {formatAiringTime(anime.nextAiringEpisode.airingAt)}
          </span>
        </div>
      )}

      {anime.dubInfo?.nextDubEpisode && (
        <div className="airing-banner">
          <Mic size={16} />
          Dub ep {anime.dubInfo.nextDubEpisode.episode} arriving in{" "}
          <span className="highlight">
            <AiringCountdown
              airingAt={anime.dubInfo.nextDubEpisode.airingAt}
              fallbackSeconds={anime.dubInfo.nextDubEpisode.timeUntilAiring}
            />
          </span>
        </div>
      )}

      <div className="overview-stats-grid">
        <div className="stat-box">
          <span className="stat-label">AniList Score</span>
          <strong className="stat-value">
            {anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "?"}
          </strong>
        </div>
        {anime.malStats?.score ? (
          <div className="stat-box">
            <span className="stat-label">MAL Score</span>
            <strong className="stat-value">
              {(anime.malStats.score / 10).toFixed(1)}
            </strong>
          </div>
        ) : null}
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
            {[anime.season, anime.seasonYear].filter(Boolean).join(" ") || "?"}
          </strong>
        </div>
        <div className="fact-item">
          <span>Status:</span>
          <strong className={anime.status === "RELEASING" ? "text-green" : ""}>
            {anime.status?.replaceAll("_", " ") || "?"}
          </strong>
        </div>
        <div className="fact-item">
          <span>Mean Score:</span>
          <strong>{anime.meanScore || "?"}</strong>
        </div>
        {anime.dubInfo?.dubbedEpisodes != null && (
          <div className="fact-item">
            <span>Dubbed Episodes:</span>
            <strong>
              {anime.dubInfo.dubbedEpisodes}
              {anime.dubInfo.totalEpisodes
                ? ` / ${anime.dubInfo.totalEpisodes}`
                : ""}
            </strong>
          </div>
        )}
        {anime.malStats?.scoredBy && (
          <div className="fact-item">
            <span>MAL Ratings:</span>
            <strong>{compactNumber(anime.malStats.scoredBy)}</strong>
          </div>
        )}
        {anime.malStats?.rank && (
          <div className="fact-item">
            <span>MAL Rank:</span>
            <strong>#{anime.malStats.rank}</strong>
          </div>
        )}
        <div className="fact-item">
          <span>Source:</span>
          <strong>{anime.source?.replaceAll("_", " ") || "?"}</strong>
        </div>
        <div className="fact-item">
          <span>Country:</span>
          <strong>{anime.countryOfOrigin || "?"}</strong>
        </div>
        <div className="fact-item">
          <span>Hashtag:</span>
          <strong>{anime.hashtag || "?"}</strong>
        </div>
        <div className="fact-item">
          <span>Native Title:</span>
          <strong>{anime.title?.native || "N/A"}</strong>
        </div>
        {anime.synonyms && anime.synonyms.length > 0 && (
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
                src={`https://www.youtube.com/embed/${anime.trailer.id}${
                  autoplayTrailer ? "?autoplay=1&mute=1" : ""
                }`}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <a href={anime.trailer.id || ""} target="_blank" rel="noreferrer">
                Watch Trailer
              </a>
            )}
          </div>
        </div>
      )}

      <div className="meta-section">
        <h2>Studios</h2>
        <div className="meta-pills-row">
          {(anime.studios ?? []).map((s) => (
            <span key={s.id} className="meta-pill">
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <div className="meta-section">
        <h2>Genres</h2>
        <div className="meta-pills-row">
          {(anime.genres ?? []).map((g) => (
            <span key={g} className="meta-pill">
              {g}
            </span>
          ))}
        </div>
      </div>

      <div className="meta-section">
        <h2>Tags</h2>
        <div className="meta-pills-row">
          {(anime.tags ?? []).map((t) => (
            <span key={t} className="meta-pill">
              {t}
            </span>
          ))}
        </div>
      </div>

      <DetailsCast
        anime={anime}
        mode="preview"
        onShowMore={onShowMoreCharacters}
      />
    </div>
  );
}
