import { NextResponse, after } from "next/server";
import {
  clearHistory,
  getPrivateUser,
  recordHistory,
  upsertLibraryEntry,
} from "@/lib/account-store";
import { requireSessionUser } from "@/lib/auth";
import { saveAniListLibraryEntry } from "@/lib/providers/anilist";
import type { AnimeSummary } from "@/types/anime";

function isValidAnimeSummary(value: unknown): value is AnimeSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    Number.isFinite(Number((value as { id: unknown }).id))
  );
}

function clampEpisode(value: unknown, max: number | null | undefined) {
  const episode = Number(value);

  if (!Number.isFinite(episode)) {
    return 1;
  }

  return Math.min(max || 10_000, Math.max(1, Math.floor(episode)));
}

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();
    const user = await getPrivateUser(sessionUser.id);
    return NextResponse.json({ entries: user?.historyEntries || [] });
  } catch {
    return NextResponse.json({ entries: [] }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSessionUser();
    const user = await getPrivateUser(sessionUser.id);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.preferences.pauseHistory) {
      return NextResponse.json({ entry: null, syncWarning: null, paused: true });
    }

    const body = (await request.json()) as {
      anime: AnimeSummary;
      episode: number;
      episodeTitle: string;
      episodeImage?: string | null;
      durationLabel: string | null;
      progressPercent: number;
      /** Progress ticks only update the history entry — no library/AniList sync. */
      progressOnly?: boolean;
    };

    if (!isValidAnimeSummary(body.anime)) {
      return NextResponse.json(
        { error: "Invalid anime payload." },
        { status: 400 },
      );
    }

    const episode = clampEpisode(body.episode, body.anime.episodes);
    const today = new Date().toISOString().slice(0, 10);
    const progressPercent = Math.min(
      100,
      Math.max(0, Number(body.progressPercent) || 0),
    );
    const episodeTitle = String(
      body.episodeTitle || `Episode ${episode}`,
    ).slice(0, 240);
    const episodeImage =
      typeof body.episodeImage === "string" &&
      /^https:\/\//.test(body.episodeImage)
        ? body.episodeImage.slice(0, 600)
        : null;

    const historyEntry = await recordHistory({
      userId: user.id,
      anime: body.anime,
      episode,
      episodeTitle,
      episodeImage,
      durationLabel: body.durationLabel,
      progressPercent,
    });

    if (body.progressOnly) {
      return NextResponse.json({ entry: historyEntry, syncWarning: null });
    }

    const currentLibraryEntry =
      user.libraryEntries.find((entry) => entry.animeId === body.anime.id) ||
      null;
    const nextStatus =
      body.anime.episodes && episode >= body.anime.episodes
        ? "completed"
        : currentLibraryEntry?.status === "planning"
          ? "watching"
          : currentLibraryEntry?.status || "watching";
    const progress = Math.max(currentLibraryEntry?.progress || 0, episode);
    const localLibraryEntry = await upsertLibraryEntry({
      userId: user.id,
      anime: body.anime,
      status: nextStatus,
      score: currentLibraryEntry?.score || 0,
      progress,
      repeat: currentLibraryEntry?.repeat || 0,
      notes: currentLibraryEntry?.notes || "",
      startedAt: currentLibraryEntry?.startedAt || today,
      completedAt: nextStatus === "completed" ? today : null,
      aniListEntryId: currentLibraryEntry?.aniListEntryId || null,
    });
    // Mirror to AniList after the response is sent so marking an episode
    // watched returns on the local write, not a remote GraphQL round-trip.
    if (user.aniListAccessToken) {
      const accessToken = user.aniListAccessToken;
      after(async () => {
        try {
          const aniListEntryId = await saveAniListLibraryEntry(
            accessToken,
            localLibraryEntry,
          );

          if (aniListEntryId) {
            await upsertLibraryEntry({
              userId: user.id,
              anime: body.anime,
              status: nextStatus,
              score: currentLibraryEntry?.score || 0,
              progress,
              repeat: currentLibraryEntry?.repeat || 0,
              notes: currentLibraryEntry?.notes || "",
              startedAt: currentLibraryEntry?.startedAt || today,
              completedAt: nextStatus === "completed" ? today : null,
              aniListEntryId,
            });
          }
        } catch {
          // Local write already succeeded; a failed mirror is non-fatal.
        }
      });
    }

    return NextResponse.json({ entry: historyEntry, syncWarning: null });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "History save failed.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  try {
    const sessionUser = await requireSessionUser();
    const user = await clearHistory(sessionUser.id);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not clear history.",
      },
      { status: 400 },
    );
  }
}
