"use client";

import { useEffect, useState } from "react";
import { useBannerFallback } from "@/components/banner-fallback-provider";
import { formatAiringTime, getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import type { AiringItem } from "@/types/anime";
import Image from "next/image";
import Link from "next/link";

function LiveCountdown({ airingAt }: { airingAt: number }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = airingAt - now;

      if (diff <= 0) {
        setTimeLeft("Just aired");
        return;
      }

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);

      if (hours > 0) {
        setTimeLeft(`in ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`in ${minutes}m`);
      }
    };

    update();
    const interval = setInterval(update, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [airingAt]);

  return <>{timeLeft}</>;
}

export function AiringRow({ item }: { item: AiringItem }) {
  const titleLanguage = useTitleLanguage();
  const banner = useBannerFallback(item.anime.id, item.anime.bannerImage);

  return (
    <Link
      href={`/anime/${item.anime.id}`}
      className="airing-row"
      key={`${item.anime.id}-${item.episode}`}
    >
      {banner && (
        <div className="airing-row-bg">
          <Image
            src={banner}
            alt=""
            fill
            sizes="(max-width: 780px) 100vw, 1480px"
            className="airing-row-image"
          />
        </div>
      )}
      <span className="airing-episode">EP {item.episode}</span>
      <span className="airing-info">
        <strong>{getDisplayTitle(item.anime.title, titleLanguage)}</strong>
        <small>{formatAiringTime(item.airingAt)}</small>
      </span>
      <span className="airing-countdown">
        <LiveCountdown airingAt={item.airingAt} />
      </span>
    </Link>
  );
}
