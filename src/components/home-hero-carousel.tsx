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
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClickPrevented, setIsClickPrevented] = useState(false);

  useEffect(() => {
    const activeImage = items[activeIndex]?.bannerImage;

    if (!activeImage) {
      document.documentElement.style.removeProperty("--site-header-image");
      return;
    }

    const cssImageUrl = activeImage
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"');

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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setDragOffset(0);
    setIsClickPrevented(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const currentX = e.clientX;
    const diff = currentX - startX;
    setDragOffset(diff);

    // If moved more than 5px, prevent click to avoid accidental navigation while dragging
    if (Math.abs(diff) > 5) {
      setIsClickPrevented(true);
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;

    const threshold = 100;
    if (dragOffset > threshold) {
      setActiveIndex((current) => (current - 1 + items.length) % items.length);
    } else if (dragOffset < -threshold) {
      setActiveIndex((current) => (current + 1) % items.length);
    }

    setIsDragging(false);
    setDragOffset(0);
    // Use a small timeout to let the click event be blocked if we dragged
    setTimeout(() => setIsClickPrevented(false), 0);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (isClickPrevented) {
      e.preventDefault();
    }
  };

  return (
    <section
      className="celestia-hero"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      <div className="celestia-hero-inner">
        <div
          className="celestia-hero-track"
          style={{
            transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
            transition: isDragging ? "none" : "transform 0.5s ease",
          }}
        >
          {items.map((item, index) => {
            const title = getDisplayTitle(item.title);

            return (
              <article
                className="celestia-slide"
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
                    className="celestia-hero-backdrop"
                    draggable={false}
                  />
                ) : null}
                <div className="celestia-hero-shade" />
                <div className="celestia-copy">
                  <div className="celestia-copy-main">
                    <Link
                      href={`/anime/${item.id}`}
                      className="celestia-hero-title-link"
                      onClick={handleLinkClick}
                    >
                      <h1>{title}</h1>
                    </Link>
                    <p className="celestia-description">
                      {(item.genres ?? []).slice(0, 3).join(" • ") || "Anime"}{" "}
                      with fresh episodes and a simple watch flow.
                    </p>
                    <div className="celestia-pills">
                      <span>{item.format || "Anime"}</span>
                      <span>
                        <Captions size={14} aria-hidden />
                        {item.airingCount || 0}
                      </span>
                      {item.dubCount != null ? (
                        <span>
                          <Mic size={14} aria-hidden />
                          {item.dubCount}
                        </span>
                      ) : null}
                      <span>{item.seasonYear || "Now"}</span>
                    </div>
                  </div>

                  <div className="celestia-actions">
                    {item.status === "NOT_YET_RELEASED" ? (
                      <div className="celestia-watch disabled">Coming Soon</div>
                    ) : (
                      <Link
                        className="celestia-watch"
                        href={`/watch/${item.id}?ep=1`}
                        onClick={handleLinkClick}
                      >
                        Watch Now
                      </Link>
                    )}
                    <Link
                      className="celestia-more"
                      href={`/anime/${item.id}`}
                      onClick={handleLinkClick}
                    >
                      <Plus size={16} aria-hidden />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="celestia-dots" aria-label="Featured airing anime">
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
