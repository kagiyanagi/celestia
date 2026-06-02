# AnimeDetailsShell Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break the massive `src/components/anime-details-shell.tsx` component into a modular directory structure under `src/components/AnimeDetailsShell/`.

**Architecture:** Use a main orchestrator (`index.tsx`) that manages state and renders specialized sub-components. Extract formatting and filter logic into `helpers.ts`. Wrap tab contents in ErrorBoundaries.

**Tech Stack:** React, TypeScript, Next.js, Lucide React, Tailwind CSS.

---

### Task 1: Create helpers.ts

**Files:**
- Create: `src/components/AnimeDetailsShell/helpers.ts`

- [ ] **Step 1: Extract logic into helpers.ts**
Extract `formatDate` and title/relation formatting logic.

```typescript
import { AnimeDate, AnimeRelation } from "@/types/anime";

export function formatDate(date: AnimeDate | null): string {
  if (!date || (!date.year && !date.month && !date.day)) return "?";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const m = date.month ? months[date.month - 1] : "";
  return [m, date.day, date.year].filter(Boolean).join(" ");
}

export function getRelatedItems(relations: AnimeRelation[]) {
  return relations.filter((item) =>
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
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/AnimeDetailsShell/helpers.ts
git commit -m "refactor: create helpers for AnimeDetailsShell"
```

### Task 2: Create DetailsHero component

**Files:**
- Create: `src/components/AnimeDetailsShell/DetailsHero.tsx`

- [ ] **Step 1: Implement DetailsHero**
Extract the hero stage and info sections.

```tsx
import Image from "next/image";
import Link from "next/link";
import { Play, Bookmark, Share2, Radio } from "lucide-react";
import { AnimeDetails } from "@/types/anime";

interface DetailsHeroProps {
  anime: AnimeDetails;
  watchHref: string;
  title: string;
  secondaryTitle: string | null;
}

export function DetailsHero({ anime, watchHref, title, secondaryTitle }: DetailsHeroProps) {
  return (
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
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/AnimeDetailsShell/DetailsHero.tsx
git commit -m "feat: add DetailsHero component"
```

### Task 3: Create DetailsTabs and Navigation types

**Files:**
- Create: `src/components/AnimeDetailsShell/DetailsTabs.tsx`

- [ ] **Step 1: Implement DetailsTabs**
Extract the tab navigation bar.

```tsx
export type TabKey = "overview" | "characters" | "episodes" | "related" | "similar";

interface DetailsTabsProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

export function DetailsTabs({ activeTab, setActiveTab }: DetailsTabsProps) {
  const tabs: TabKey[] = ["overview", "characters", "episodes", "related", "similar"];
  
  return (
    <nav className="anime-tabs-nav">
      {tabs.map((tab) => (
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
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/AnimeDetailsShell/DetailsTabs.tsx
git commit -m "feat: add DetailsTabs component"
```

### Task 4: Create DetailsCast component

**Files:**
- Create: `src/components/AnimeDetailsShell/DetailsCast.tsx`

- [ ] **Step 1: Implement DetailsCast**
This will handle both the mini preview (used in Overview) and the full characters tab.

```tsx
import Image from "next/image";
import { AnimeDetails } from "@/types/anime";

interface DetailsCastProps {
  anime: AnimeDetails;
  mode: "preview" | "full";
  onShowMore?: () => void;
}

export function DetailsCast({ anime, mode, onShowMore }: DetailsCastProps) {
  if (mode === "preview") {
    return (
      <>
        <div className="cast-section">
          <div className="section-header-row">
            <h2>Characters</h2>
            <button
              className="show-more"
              type="button"
              onClick={onShowMore}
            >
              Show more
            </button>
          </div>
          <div className="cast-grid">
            {(anime.characters ?? []).slice(0, 12).map((char) => (
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
            {(anime.staff ?? []).map((s) => (
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
      </>
    );
  }

  return (
    <div className="tab-characters">
      <div className="section-header-row">
        <h2>Characters</h2>
        <span className="characters-count">
          {(anime.characters ?? []).length} total
        </span>
      </div>

      <div className="character-tab-grid">
        {(anime.characters ?? []).map((char) => (
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
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/AnimeDetailsShell/DetailsCast.tsx
git commit -m "feat: add DetailsCast component"
```

### Task 5: Create DetailsOverview component

**Files:**
- Create: `src/components/AnimeDetailsShell/DetailsOverview.tsx`

- [ ] **Step 1: Implement DetailsOverview**
Integrate `DetailsCast` for the preview.

```tsx
import { Clock } from "lucide-react";
import { AnimeDetails } from "@/types/anime";
import { formatDate } from "./helpers";
import { DetailsCast } from "./DetailsCast";

interface DetailsOverviewProps {
  anime: AnimeDetails;
  onShowMoreCharacters: () => void;
}

export function DetailsOverview({ anime, onShowMoreCharacters }: DetailsOverviewProps) {
  return (
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

      <DetailsCast anime={anime} mode="preview" onShowMore={onShowMoreCharacters} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/AnimeDetailsShell/DetailsOverview.tsx
git commit -m "feat: add DetailsOverview component"
```

### Task 6: Create DetailsEpisodes component

**Files:**
- Create: `src/components/AnimeDetailsShell/DetailsEpisodes.tsx`

- [ ] **Step 1: Implement DetailsEpisodes**
Handle pagination and sorting.

```tsx
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
    <div className="tab-episodes">
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
              {(ep.thumbnail || anime.bannerImage) ? (
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
```

- [ ] **Step 2: Commit**
```bash
git add src/components/AnimeDetailsShell/DetailsEpisodes.tsx
git commit -m "feat: add DetailsEpisodes component"
```

### Task 7: Create DetailsRelations and DetailsSimilar components

**Files:**
- Create: `src/components/AnimeDetailsShell/DetailsRelations.tsx`
- Create: `src/components/AnimeDetailsShell/DetailsSimilar.tsx`

- [ ] **Step 1: Implement DetailsRelations**

```tsx
import Image from "next/image";
import Link from "next/link";
import { AnimeRelation } from "@/types/anime";
import { getDisplayTitle } from "@/lib/format";

interface DetailsRelationsProps {
  relatedItems: AnimeRelation[];
}

export function DetailsRelations({ relatedItems }: DetailsRelationsProps) {
  return (
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
  );
}
```

- [ ] **Step 2: Implement DetailsSimilar**

```tsx
import Image from "next/image";
import Link from "next/link";
import { AnimeDetails } from "@/types/anime";
import { getDisplayTitle } from "@/lib/format";

interface DetailsSimilarProps {
  recommendations: AnimeDetails["recommendations"];
}

export function DetailsSimilar({ recommendations }: DetailsSimilarProps) {
  return (
    <div className="tab-similar">
      <div className="relations-grid">
        {(recommendations ?? []).map((rec) => (
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
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add src/components/AnimeDetailsShell/DetailsRelations.tsx src/components/AnimeDetailsShell/DetailsSimilar.tsx
git commit -m "feat: add DetailsRelations and DetailsSimilar components"
```

### Task 8: Create the orchestrator index.tsx

**Files:**
- Create: `src/components/AnimeDetailsShell/index.tsx`

- [ ] **Step 1: Implement the index.tsx orchestrator**
Apply ErrorBoundaries as requested.

```tsx
"use client";

import { useState } from "react";
import { AnimeDetails } from "@/types/anime";
import { getDisplayTitle, getSecondaryTitle } from "@/lib/format";
import { ErrorBoundary } from "@/components/error-boundary";
import { getRelatedItems } from "./helpers";

import { DetailsHero } from "./DetailsHero";
import { DetailsTabs, TabKey } from "./DetailsTabs";
import { DetailsOverview } from "./DetailsOverview";
import { DetailsCast } from "./DetailsCast";
import { DetailsEpisodes } from "./DetailsEpisodes";
import { DetailsRelations } from "./DetailsRelations";
import { DetailsSimilar } from "./DetailsSimilar";

interface AnimeDetailsShellProps {
  anime: AnimeDetails;
  watchHref: string;
}

export function AnimeDetailsShell({ anime, watchHref }: AnimeDetailsShellProps) {
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
        {activeTab === "overview" && (
          <ErrorBoundary>
            <DetailsOverview 
              anime={anime} 
              onShowMoreCharacters={() => setActiveTab("characters")} 
            />
          </ErrorBoundary>
        )}

        {activeTab === "characters" && (
          <ErrorBoundary>
            <DetailsCast anime={anime} mode="full" />
          </ErrorBoundary>
        )}

        {activeTab === "episodes" && (
          <ErrorBoundary>
            <DetailsEpisodes anime={anime} watchHref={watchHref} />
          </ErrorBoundary>
        )}

        {activeTab === "related" && (
          <ErrorBoundary>
            <DetailsRelations relatedItems={relatedItems} />
          </ErrorBoundary>
        )}

        {activeTab === "similar" && (
          <ErrorBoundary>
            <DetailsSimilar recommendations={anime.recommendations} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/AnimeDetailsShell/index.tsx
git commit -m "feat: implement AnimeDetailsShell orchestrator"
```

### Task 9: Update entry point and verify

**Files:**
- Modify: `src/components/anime-details-shell.tsx`

- [ ] **Step 1: Update the old file to export the new component**

```tsx
export { AnimeDetailsShell } from "./AnimeDetailsShell";
```

- [ ] **Step 2: Verify imports in page.tsx**
Ensure `src/app/anime/[id]/page.tsx` still works.

- [ ] **Step 3: Run typecheck**
Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/components/anime-details-shell.tsx
git commit -m "refactor: export AnimeDetailsShell from the new directory"
```
