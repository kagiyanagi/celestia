"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MessageSquare, Newspaper } from "lucide-react";

import { formatIsoDate } from "@/lib/format";
import type { AnimeNewsArticle } from "@/types/anime";

interface DetailsNewsProps {
  animeId: number;
}

export function DetailsNews({ animeId }: DetailsNewsProps) {
  const [articles, setArticles] = useState<AnimeNewsArticle[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/anime/${animeId}/news`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("request failed")),
      )
      .then((data: { articles: AnimeNewsArticle[] }) => {
        if (cancelled) return;
        setArticles(data.articles ?? []);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  if (status === "loading") {
    return (
      <div className="news-message">
        <span>Loading news…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="news-message">
        <span>Couldn’t load news right now.</span>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="news-message">
        <Newspaper size={20} />
        <span>No recent news for this title.</span>
      </div>
    );
  }

  return (
    <div className="news-list">
      {articles.map((article) => {
        const date = formatIsoDate(article.date);
        return (
          <a
            key={article.id}
            className="news-card"
            href={article.url}
            target="_blank"
            rel="noreferrer"
          >
            {article.imageUrl && (
              <span className="news-card-thumb">
                <Image
                  src={article.imageUrl}
                  alt=""
                  fill
                  sizes="120px"
                />
              </span>
            )}
            <span className="news-card-body">
              <strong className="news-card-title">{article.title}</strong>
              {article.excerpt && (
                <span className="news-card-excerpt">{article.excerpt}</span>
              )}
              <span className="news-card-meta">
                {date && <span>{date}</span>}
                {article.author && <span>{article.author}</span>}
                {article.comments != null && article.comments > 0 && (
                  <span className="news-card-comments">
                    <MessageSquare size={13} />
                    {article.comments}
                  </span>
                )}
              </span>
            </span>
          </a>
        );
      })}
      <p className="news-attribution">News from MyAnimeList via Jikan.</p>
    </div>
  );
}
