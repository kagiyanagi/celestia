"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Captions, Mic, Plus } from "lucide-react";

import { getDisplayTitle } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type HomeHeroCarouselProps = {
  items: AnimeSummary[];
};

export function HomeHeroCarousel({ items }: HomeHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const activeImage = items[activeIndex]?.bannerImage;

    if (!activeImage) {
      document.documentElement.style.removeProperty("--site-header-image");
      return;
    }

    const cssImageUrl = activeImage.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

    document.documentElement.style.setProperty(
      "--site-header-image",
      `url("${cssImageUrl}")`,
    );

    return () => {
      document.documentElement.style.removeProperty("--site-header-image");
    };
  }, [activeIndex, items]);

  useEffect(() => {
    if (items.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) {
    return null;
  }

  return (
    <section className="animetsu-hero">
      <div className="animetsu-hero-inner">
        <div
          className="animetsu-hero-track"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {items.map((item, index) => {
            const title = getDisplayTitle(item.title);

            return (
              <article
                className="animetsu-slide"
                key={item.id}
                style={
                  {
                    "--theme-color": item.color || "rgba(255, 255, 255, 0.2)",
                  } as React.CSSProperties
                }
              >
                {item.bannerImage ? (
                  <Image
                    src={item.bannerImage}
                    alt=""
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="animetsu-hero-backdrop"
                  />
                ) : null}
                <div className="animetsu-hero-shade" />
                <div className="animetsu-copy">
                  <div className="animetsu-copy-main">
                    <h1>{title}</h1>
                    <p className="animetsu-description">
                      {item.genres.slice(0, 3).join(" • ") || "Anime"} with
                      fresh episodes and a simple watch flow.
                    </p>
                    <div className="animetsu-pills">
                      <span>{item.format || "Anime"}</span>
                      <span>
                        <Captions size={14} aria-hidden />
                        {item.airingCount || 0}
                      </span>
                      <span>
                        <Mic size={14} aria-hidden />
                        {item.dubCount || 0}
                      </span>
                      <span>{item.seasonYear || "Now"}</span>
                    </div>
                  </div>

                  <div className="animetsu-actions">
                    <Link
                      className="animetsu-watch"
                      href={`/watch/${item.id}?ep=1`}
                    >
                      Watch Now
                    </Link>
                    <Link className="animetsu-more" href={`/anime/${item.id}`}>
                      <Plus size={16} aria-hidden />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="animetsu-dots" aria-label="Featured airing anime">
          {items.map((item, index) => (
            <button
              aria-label={`Show ${getDisplayTitle(item.title)}`}
              className={index === activeIndex ? "active" : ""}
              key={item.id}
              onClick={() => setActiveIndex(index)}
              type="button"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
