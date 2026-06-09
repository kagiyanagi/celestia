"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { getDisplayTitle, getSecondaryTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import { ErrorBoundary } from "@/components/error-boundary";
import type { AnimeDetails } from "@/types/anime";

import { DetailsHero } from "./DetailsHero";
import { DetailsTabs, isTabKey, type TabKey } from "./DetailsTabs";
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
  initialTab?: TabKey;
}

export function AnimeDetailsShell({
  anime,
  watchHref,
  initialTab = "overview",
}: AnimeDetailsShellProps) {
  // Initial tab comes from the server (?tab=) so SSR and the first client
  // render agree; the popstate listener then keeps it synced with back/forward.
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const titleLanguage = useTitleLanguage();

  useEffect(() => {
    const onPopState = () => {
      const tab = new URLSearchParams(window.location.search).get("tab");
      setActiveTab(isTabKey(tab) ? tab : "overview");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Switching a tab writes ?tab= without a navigation, so the URL is
  // shareable/bookmarkable and the section stays a pure client swap.
  const selectTab = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

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

      <DetailsTabs activeTab={activeTab} setActiveTab={selectTab} />

      <div className="tab-content">
        <ErrorBoundary>
          {activeTab === "overview" && (
            <DetailsOverview
              anime={anime}
              onShowMoreCharacters={() => selectTab("characters")}
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
