import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import type { AiringItem } from "@/types/anime";
import { AiringRow } from "./airing-row";

type AiringBoardProps = {
  items: AiringItem[];
};

export function AiringBoard({ items }: AiringBoardProps) {
  return (
    <div className="airing-board">
      <div className="home-section-head">
        <div className="section-kicker">
          <Radio size={16} aria-hidden />
          airing soon
        </div>
        <Link href="/schedule">
          View all
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <h2>Episodes dropping next.</h2>
      <p>
        A quick board for upcoming releases, so you know what to watch when it
        lands.
      </p>

      <div className="airing-list">
        {items.length ? (
          items.map((item) => (
            <AiringRow key={`${item.anime.id}-${item.episode}`} item={item} />
          ))
        ) : (
          <div className="empty-panel">
            Airing data is temporarily unavailable.
          </div>
        )}
      </div>
    </div>
  );
}
