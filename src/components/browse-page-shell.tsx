import { AnimeCard } from "@/components/anime-card";
import type { AnimeSummary } from "@/types/anime";

type BrowsePageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: AnimeSummary[];
};

export function BrowsePageShell({
  eyebrow,
  title,
  description,
  items,
}: BrowsePageShellProps) {
  return (
    <div className="page-shell compact-page">
      <section className="search-hero browse-hero">
        <span className="section-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <section className="section-shell">
        <div className="section-heading">
          <span>{items.length} titles</span>
          <h2>{title}</h2>
        </div>

        <div className="anime-grid search-results">
          {items.map((anime) => (
            <AnimeCard anime={anime} key={anime.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
