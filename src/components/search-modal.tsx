"use client";

import { Captions, Mic, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getDisplayTitle, scoreLabel } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < 2) {
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          setResults(data);
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
    onClose();
  };

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = event.target.value;

    setQuery(nextQuery);

    if (nextQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      closeModal();
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else if (e.key === "Escape") {
      closeModal();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={closeModal}>
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
          <button className="search-modal-close" onClick={closeModal}>
            <X size={20} />
          </button>
        </div>

        <div className="search-modal-results">
          {isLoading && query.length >= 2 && (
            <div className="search-modal-status">Searching...</div>
          )}

          {!isLoading && query.length >= 2 && results.length === 0 && (
            <div className="search-modal-status">No results found for {query}</div>
          )}

          {results.map((anime) => (
            <Link
              key={anime.id}
              href={`/anime/${anime.id}`}
              className="search-result-item"
              onClick={closeModal}
            >
              <div className="search-result-poster">
                {anime.coverImage && (
                  <Image src={anime.coverImage} alt="" fill sizes="60px" />
                )}
              </div>
              <div className="search-result-info">
                <div className="search-result-top">
                  <span className="search-result-format">{anime.format || "Anime"}</span>
                  <span className="search-result-year">{anime.seasonYear}</span>
                  <span className="search-result-score">{scoreLabel(anime.averageScore)}</span>
                </div>
                <strong className="search-result-title">{getDisplayTitle(anime.title)}</strong>
                <div className="search-result-stats">
                  <span><Captions size={12} /> {anime.airingCount || 0}</span>
                  <span><Mic size={12} /> {anime.dubCount || 0}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {query.length >= 2 && (
          <div className="search-modal-footer">
            Press <span>Enter</span> for all results
          </div>
        )}
      </div>
    </div>
  );
}
