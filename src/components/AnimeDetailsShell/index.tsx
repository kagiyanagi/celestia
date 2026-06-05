"use client";

import { useState } from "react";
import { getDisplayTitle, getSecondaryTitle } from "@/lib/format";
import { ErrorBoundary } from "@/components/error-boundary";
import type { AnimeDetails } from "@/types/anime";

import { DetailsHero } from "./DetailsHero";
import { DetailsTabs, TabKey } from "./DetailsTabs";
import { DetailsOverview } from "./DetailsOverview";
import { DetailsEpisodes } from "./DetailsEpisodes";
import { DetailsCast } from "./DetailsCast";
import { DetailsFranchise } from "./DetailsFranchise";
import { DetailsSimilar } from "./DetailsSimilar";
import { getRelatedItems } from "./helpers";

interface AnimeDetailsShellProps {
  anime: AnimeDetails;
  watchHref: string;
  /** Real episode count; may exceed anime.streamingEpisodes when the list was
   *  trimmed from the payload for a mega-show (Episodes tab then paginates). */
  episodeTotal?: number;
}

export function AnimeDetailsShell({
  anime,
  watchHref,
  episodeTotal,
}: AnimeDetailsShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const title = getDisplayTitle(anime.title);
  const secondaryTitle = getSecondaryTitle(anime.title);
  const relatedItems = getRelatedItems(anime.relations ?? []);

  return (
    <div className="anime-details-shell">
      <DetailsHero
        anime={anime}
        watchHref={watchHref}
        title={title}
        secondaryTitle={secondaryTitle}
      />

      <DetailsTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="tab-content">
        <ErrorBoundary>
          {activeTab === "overview" && (
            <DetailsOverview
              anime={anime}
              onShowMoreCharacters={() => setActiveTab("characters")}
            />
          )}

          {activeTab === "characters" && (
            <DetailsCast anime={anime} mode="full" />
          )}

          {activeTab === "episodes" && (
            <DetailsEpisodes
              anime={anime}
              watchHref={watchHref}
              episodeTotal={episodeTotal}
            />
          )}

          {activeTab === "franchise" && (
            <DetailsFranchise
              key={anime.id}
              animeId={anime.id}
              relatedItems={relatedItems}
            />
          )}

          {activeTab === "similar" && (
            <DetailsSimilar recommendations={anime.recommendations ?? []} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
