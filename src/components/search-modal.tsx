"use client";

import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Filter,
  LogOut,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getDisplayTitle } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function formatLabel(value: string | null | undefined): string {
  switch (value) {
    case "TV":
      return "TV Show";
    case "TV_SHORT":
      return "TV Short";
    case "MOVIE":
      return "Movie";
    case "SPECIAL":
      return "Special";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "MUSIC":
      return "Music";
    default:
      return "Anime";
  }
}

function episodeCountLabel(value: number | null | undefined): string {
  if (typeof value !== "number") {
    return "Episodes TBA";
  }

  return value === 1 ? "1 Episode" : `${value} Episodes`;
}

function seasonLabel(anime: AnimeSummary): string | null {
  if (!anime.season && !anime.seasonYear) {
    return null;
  }

  return [anime.season, anime.seasonYear].filter(Boolean).join(" ");
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resultItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectedIndex >= 0 && resultItemRefs.current[selectedIndex]) {
      resultItemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < 2) {
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data);
          setSelectedIndex(data.length > 0 ? 0 : -1);
        }
      } catch (error) {
        console.error("Live search failed:", error);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const closeModal = () => {
    setQuery("");
    setResults([]);
    setIsLoading(false);
    setSelectedIndex(-1);
    onClose();
  };

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;

    setQuery(nextQuery);

    if (nextQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (selectedIndex >= 0 && results[selectedIndex]) {
        closeModal();
        router.push(`/anime/${results[selectedIndex].id}`);
      } else if (query.trim()) {
        closeModal();
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    } else if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev + 1) % results.length : -1,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : -1,
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={closeModal}>
      <button
        className="search-modal-close"
        type="button"
        aria-label="Close search"
        onClick={closeModal}
      >
        <X size={24} />
      </button>

      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <Search size={20} className="search-modal-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for anime..."
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
          />
          <Link
            href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
            className="search-modal-filter"
            onClick={closeModal}
            aria-label="Advanced search"
          >
            <Filter size={20} aria-hidden />
          </Link>
        </div>

        <div className="search-modal-results" ref={resultsRef}>
          {!query && (
            <div className="search-modal-status">
              <div>What do you wanna watch today?</div>
              <p className="search-modal-tip">
                Tip: Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> to
                quickly open search from anywhere.
              </p>
            </div>
          )}

          {isLoading && query.length >= 2 && (
            <div className="search-modal-status">Searching...</div>
          )}

          {!isLoading && query.length >= 2 && results.length === 0 && (
            <div className="search-modal-status">
              No results found for {query}
            </div>
          )}

          {results.map((anime, index) => (
            <Link
              key={anime.id}
              ref={(el) => {
                resultItemRefs.current[index] = el;
              }}
              href={`/anime/${anime.id}`}
              className={`search-result-item ${index === selectedIndex ? "is-active" : ""}`}
              onClick={closeModal}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="search-result-poster">
                {anime.coverImage && (
                  <Image src={anime.coverImage} alt="" fill sizes="72px" />
                )}
              </div>
              <div className="search-result-info">
                <strong className="search-result-title">
                  {getDisplayTitle(anime.title)}
                </strong>
                <div className="search-result-meta">
                  <span>{formatLabel(anime.format)}</span>
                  <span>{episodeCountLabel(anime.episodes)}</span>
                  <span>{anime.status || "UNKNOWN"}</span>
                </div>
                {seasonLabel(anime) && (
                  <span className="search-result-season">
                    {seasonLabel(anime)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <div className="search-modal-footer">
          <div className="search-modal-keybinds">
            <span className="keybind-item">
              <span className="keybind-icons">
                <ArrowUp size={12} />
                <ArrowDown size={12} />
              </span>
              to navigate
            </span>
            <span className="keybind-item">
              <span className="keybind-icons">
                <CornerDownLeft size={12} />
              </span>
              to select
            </span>
            <span className="keybind-item">
              <span className="keybind-icons">
                <LogOut size={12} />
              </span>
              Esc to exit
            </span>
          </div>
          <Link
            href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
            className="search-modal-view-all"
            onClick={closeModal}
          >
            VIEW ALL <CornerDownLeft size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
