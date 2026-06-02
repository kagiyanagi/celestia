import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";

import {
  formatAiringTime,
  formatRelativeSeconds,
  getDisplayTitle,
} from "@/lib/format";
import type { AiringItem } from "@/types/anime";

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
            <Link
              href={`/anime/${item.anime.id}`}
              className="airing-row"
              key={`${item.anime.id}-${item.episode}`}
            >
              {item.anime.bannerImage && (
                <div className="airing-row-bg">
                  <Image
                    src={item.anime.bannerImage}
                    alt=""
                    fill
                    sizes="(max-width: 780px) 100vw, 1480px"
                    className="airing-row-image"
                  />
                </div>
              )}
              <span className="airing-episode">EP {item.episode}</span>
              <span className="airing-info">
                <strong>{getDisplayTitle(item.anime.title)}</strong>
                <small>{formatAiringTime(item.airingAt)}</small>
              </span>
              <span className="airing-countdown">
                {formatRelativeSeconds(item.timeUntilAiring)}
              </span>
            </Link>
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
