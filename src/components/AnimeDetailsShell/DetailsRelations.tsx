import Image from "next/image";
import Link from "next/link";
import { getDisplayTitle } from "@/lib/format";
import type { RelationItem } from "@/types/anime";

interface DetailsRelationsProps {
  relatedItems: RelationItem[];
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
