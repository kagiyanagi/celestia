"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { getDisplayTitle, getSecondaryTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import { ErrorBoundary } from "@/components/error-boundary";
import type { AnimeDetails } from "@/types/anime";

import { DetailsHero } from "./DetailsHero";
import { DetailsTabs, TabKey } from "./DetailsTabs";
import { DetailsOverview } from "./DetailsOverview";
import { getRelatedItems } from "./helpers";

const TabLoading = () => (
  <div className="empty-panel">Loading this section...</div>
);

const DetailsEpisodes = dynamic(
  () => import("./DetailsEpisodes").then((module) => module.DetailsEpisodes),
  { loading: TabLoading },
);
const DetailsCast = dynamic(
  () => import("./DetailsCast").then((module) => module.DetailsCast),
  { loading: TabLoading },
);
const DetailsFranchise = dynamic(
  () => import("./DetailsFranchise").then((module) => module.DetailsFranchise),
  { loading: TabLoading },
);
const DetailsNews = dynamic(
  () => import("./DetailsNews").then((module) => module.DetailsNews),
  { loading: TabLoading },
);
const DetailsSimilar = dynamic(
  () => import("./DetailsSimilar").then((module) => module.DetailsSimilar),
  { loading: TabLoading },
);

interface AnimeDetailsShellProps {
  anime: AnimeDetails;
  watchHref: string;
}

export function AnimeDetailsShell({
  anime,
  watchHref,
}: AnimeDetailsShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const titleLanguage = useTitleLanguage();

  const title = getDisplayTitle(anime.title, titleLanguage);
  const secondaryTitle = getSecondaryTitle(anime.title, titleLanguage);
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
            <DetailsEpisodes anime={anime} watchHref={watchHref} />
          )}

          {activeTab === "news" && (
            <DetailsNews key={anime.id} animeId={anime.id} />
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
