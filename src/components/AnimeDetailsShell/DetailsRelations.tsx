import Image from "next/image";
import Link from "next/link";
import { getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import type { RelationItem } from "@/types/anime";

interface DetailsRelationsProps {
  relatedItems: RelationItem[];
}

export function DetailsRelations({ relatedItems }: DetailsRelationsProps) {
  const titleLanguage = useTitleLanguage();
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
                  alt={getDisplayTitle(rel.anime.title, titleLanguage)}
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
                {getDisplayTitle(rel.anime.title, titleLanguage)}
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
