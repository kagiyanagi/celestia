"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Captions, Star } from "lucide-react";

import { useBannerContext } from "@/components/banner-fallback-provider";
import { DetailsSaveButton } from "@/components/details-save-button";
import { DubBadge } from "@/components/dub-badge";

import { cleanDescription, getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import type { AnimeSummary } from "@/types/anime";

type HomeHeroCarouselProps = {
  items: AnimeSummary[];
};

export function HomeHeroCarousel({
  items,
}: HomeHeroCarouselProps) {
  const titleLanguage = useTitleLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClickPrevented, setIsClickPrevented] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const heroItems = useMemo(() => {
    return items.slice(0, 5);
  }, [items]);

  const goNext = useCallback(() => {
    setActiveIndex((current) =>
      heroItems.length ? (current + 1) % heroItems.length : 0,
    );
  }, [heroItems.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((current) =>
      heroItems.length ? (current - 1 + heroItems.length) % heroItems.length : 0,
    );
  }, [heroItems.length]);

  // Banners AniList is missing resolve client-side (off the render path); slides
  // with an AniList banner show it immediately, the rest swap in when resolved.
  const bannerCtx = useBannerContext();
  useEffect(() => {
    heroItems.forEach((item) => {
      if (!item.bannerImage) {
        bannerCtx?.register(item.id);
      }
    });
  }, [heroItems, bannerCtx]);
  const bannerFor = (item: AnimeSummary | undefined): string | null =>
    item ? item.bannerImage ?? bannerCtx?.banners.get(item.id) ?? null : null;
  const activeImage = bannerFor(heroItems[activeIndex] ?? heroItems[0]);

  useEffect(() => {
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
  }, [activeImage]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Autoplay pauses on hover/focus and is disabled entirely when the user
  // prefers reduced motion or is mid-drag.
  useEffect(() => {
    if (heroItems.length < 2 || isPaused || isDragging || reducedMotion) {
      return;
    }

    const timer = window.setInterval(goNext, 6000);

    return () => window.clearInterval(timer);
  }, [heroItems.length, isPaused, isDragging, reducedMotion, goNext]);

  if (!heroItems.length) {
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
      setActiveIndex(
        (current) => (current - 1 + heroItems.length) % heroItems.length,
      );
    } else if (dragOffset < -threshold) {
      setActiveIndex((current) => (current + 1) % heroItems.length);
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
    setIsPaused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsPaused(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setDragOffset(0);
    setIsClickPrevented(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    setDragOffset(diff);

    if (Math.abs(diff) > 5) {
      setIsClickPrevented(true);
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (isClickPrevented) {
      e.preventDefault();
    }
  };

  return (
    <section
      className="mirucast-hero"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured anime"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={handleMouseLeave}
      onFocus={() => setIsPaused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      <div className="mirucast-hero-inner">
        <div
          className="mirucast-hero-track"
          style={{
            transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
            transition:
              isDragging || reducedMotion ? "none" : "transform 0.5s ease",
          }}
        >
          {heroItems.map((item, index) => {
            const title = getDisplayTitle(item.title, titleLanguage);
            const synopsis =
              cleanDescription(item.description) ||
              (item.genres ?? []).slice(0, 3).join(" • ") ||
              "Anime";

            return (
              <article
                className="mirucast-slide"
                key={item.id}
                style={
                  {
                    "--theme-color": item.color || "rgba(255, 255, 255, 0.2)",
                  } as React.CSSProperties
                }
              >
                {bannerFor(item) ? (
                  <Image
                    src={bannerFor(item) as string}
                    alt=""
                    fill
                    priority={index === 0}
                    quality={90}
                    sizes="100vw"
                    className="mirucast-hero-backdrop"
                    draggable={false}
                  />
                ) : null}
                {item.coverImage ? (
                  <Image
                    src={item.coverImage}
                    alt=""
                    fill
                    priority={index === 0}
                    quality={90}
                    sizes="(max-width: 480px) 100vw, 1px"
                    className="mirucast-hero-cover"
                    draggable={false}
                  />
                ) : null}
                <div className="mirucast-hero-shade" />
                <div className="mirucast-copy">
                  <div className="mirucast-copy-main">
                    <Link
                      href={`/anime/${item.id}`}
                      className="mirucast-hero-title-link"
                      onClick={handleLinkClick}
                    >
                      <h1>{title}</h1>
                    </Link>
                    <p className="mirucast-description">{synopsis}</p>
                    <div className="mirucast-pills">
                      <span>{item.format || "Anime"}</span>
                      {typeof item.averageScore === "number" ? (
                        <span>
                          <Star size={14} aria-hidden />
                          {(item.averageScore / 10).toFixed(1)}
                        </span>
                      ) : null}
                      {item.airingCount != null ? (
                        <span>
                          <Captions size={14} aria-hidden />
                          {item.airingCount}
                        </span>
                      ) : null}
                      <DubBadge
                        animeId={item.id}
                        initial={item.dubCount ?? null}
                        iconSize={14}
                      />
                      <span>{item.seasonYear || "Now"}</span>
                    </div>
                  </div>

                  <div className="mirucast-actions">
                    {item.status === "NOT_YET_RELEASED" ? (
                      <div className="mirucast-watch disabled">Coming Soon</div>
                    ) : (
                      <Link
                        className="mirucast-watch"
                        href={`/watch/${item.id}?ep=1`}
                        onClick={handleLinkClick}
                      >
                        Watch Now
                      </Link>
                    )}
                    <DetailsSaveButton anime={item} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mirucast-dots" aria-label="Featured airing anime">
          {heroItems.map((item, index) => (
            <button
              aria-label={`Show ${getDisplayTitle(item.title, titleLanguage)}`}
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
