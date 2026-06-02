import type { Metadata } from "next";

import { AnimeCard } from "@/components/anime-card";
import { SearchBox } from "@/components/search-box";
import { searchAnime } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Search",
};

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? await searchAnime(query) : [];

  return (
    <div className="page-shell compact-page">
      <section className="search-hero">
        <span className="section-kicker">catalog search</span>
        <h1>Find something to watch.</h1>
        <p>
          Search anime by title, open the detail page, then jump straight into
          episodes.
        </p>
        <SearchBox defaultValue={query} label="Search AniList" />
      </section>

      <section className="section-shell">
        <div className="section-heading">
          <span>{query ? `${results.length} matches` : "ready"}</span>
          <h2>{query ? `Results for "${query}"` : "Start with a title"}</h2>
        </div>

        <div className="anime-grid search-results">
          {results.length ? (
            results.map((anime) => <AnimeCard anime={anime} key={anime.id} />)
          ) : (
            <div className="empty-panel">
              {query
                ? "No results came back from AniList for this query."
                : "Try a title like One Piece, Frieren, Naruto, or Vinland Saga."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
