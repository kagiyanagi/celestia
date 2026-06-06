import Image from "next/image";
import Link from "next/link";
import { getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import type { AnimeSummary } from "@/types/anime";

interface DetailsSimilarProps {
  recommendations: AnimeSummary[];
}

export function DetailsSimilar({ recommendations }: DetailsSimilarProps) {
  const titleLanguage = useTitleLanguage();
  return (
    <div className="tab-similar">
      <div className="relations-grid">
        {recommendations.map((rec) => (
          <Link
            key={rec.id}
            href={`/anime/${rec.id}`}
            className="relation-card-wide"
          >
            <div className="rel-poster">
              {rec.coverImage && (
                <Image
                  src={rec.coverImage}
                  alt={getDisplayTitle(rec.title, titleLanguage)}
                  fill
                  sizes="80px"
                />
              )}
            </div>
            <div className="rel-info">
              <strong className="rel-title">
                {getDisplayTitle(rec.title, titleLanguage)}
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
