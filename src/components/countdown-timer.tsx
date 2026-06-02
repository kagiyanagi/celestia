"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

type CountdownTimerProps = {
  airingAt: number;
  episode: number;
};

export function CountdownTimer({ airingAt, episode }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = airingAt - now;

      if (diff <= 0) {
        setTimeLeft("Just aired!");
        return;
      }

      const days = Math.floor(diff / (60 * 60 * 24));
      const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
      const minutes = Math.floor((diff % (60 * 60)) / 60);
      const seconds = diff % 60;

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(parts.join(" "));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [airingAt]);

  return (
    <div className="airing-countdown-card">
      <span className="section-kicker">
        <Clock size={14} aria-hidden />
        next episode
      </span>
      <strong>Episode {episode}</strong>
      <p>{timeLeft}</p>
    </div>
  );
}
