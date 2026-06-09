"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getDisplayTitle } from "@/lib/format";
import type { AnimeSummary } from "@/types/anime";

export function DetailsFavoriteButton({ anime }: { anime: AnimeSummary }) {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const favorited = (user?.favorites ?? []).some(
    (fav) => fav.kind === "anime" && fav.id === anime.id,
  );

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/me/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "anime",
          id: anime.id,
          name: getDisplayTitle(anime.title, user.preferences.titleLanguage),
          image: anime.coverImage ?? null,
        }),
      });
      const payload = (await response.json()) as { user?: typeof user };
      if (response.ok && payload.user) {
        setUser(payload.user);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={`hero-icon-btn ${favorited ? "is-active" : ""}`}
      title={favorited ? "Remove from favourites" : "Add to favourites"}
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
    >
      <Heart size={20} fill={favorited ? "currentColor" : "none"} />
    </button>
  );
}
