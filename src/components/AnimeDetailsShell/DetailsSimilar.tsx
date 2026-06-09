import { AnimeCard } from "@/components/anime-card";
import type { AnimeSummary } from "@/types/anime";

interface DetailsSimilarProps {
  recommendations: AnimeSummary[];
}

export function DetailsSimilar({ recommendations }: DetailsSimilarProps) {
  if (recommendations.length === 0) {
    return <div className="empty-panel">No recommendations for this title yet.</div>;
  }

  // Reuse the shared card so recommendations get the same score, dub badge,
  // library-status chip, and hover quick-add as everywhere else. AniList
  // already returns these sorted by recommendation strength (RATING_DESC).
  return (
    <div className="tab-similar">
      <div className="anime-grid">
        {recommendations.map((rec) => (
          <AnimeCard key={rec.id} anime={rec} />
        ))}
      </div>
    </div>
  );
}
