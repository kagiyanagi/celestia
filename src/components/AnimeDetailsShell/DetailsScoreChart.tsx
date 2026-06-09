import type { ScoreBucket } from "@/types/anime";

interface DetailsScoreChartProps {
  distribution: ScoreBucket[];
}

export function DetailsScoreChart({ distribution }: DetailsScoreChartProps) {
  if (!distribution || distribution.length === 0) {
    return null;
  }

  const max = Math.max(...distribution.map((bucket) => bucket.amount), 1);
  const total = distribution.reduce((sum, bucket) => sum + bucket.amount, 0);

  return (
    <div className="meta-section">
      <h2>Score Distribution</h2>
      <div className="score-chart" role="img" aria-label="AniList score distribution">
        {distribution.map((bucket) => {
          const heightPct = Math.round((bucket.amount / max) * 100);
          const sharePct = total ? Math.round((bucket.amount / total) * 100) : 0;
          return (
            <div className="score-chart-col" key={bucket.score}>
              <div
                className="score-chart-bar"
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                title={`${bucket.score}: ${bucket.amount.toLocaleString()} (${sharePct}%)`}
              />
              <span className="score-chart-label">{bucket.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
