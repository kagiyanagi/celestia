import { NextResponse, after } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import {
  deleteLibraryEntry,
  getLibraryEntries,
  getPrivateUser,
  upsertLibraryEntry,
} from "@/lib/account-store";
import {
  deleteAniListLibraryEntry,
  saveAniListLibraryEntry,
} from "@/lib/providers/anilist";
import { syncAniListLibrary } from "@/lib/anilist-sync";
import type { LibraryStatus } from "@/types/account";
import type { AnimeSummary } from "@/types/anime";

const VALID_STATUSES = new Set<LibraryStatus>([
  "planning",
  "watching",
  "on_hold",
  "dropped",
  "completed",
  "rewatching",
]);

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(number)));
}

function isValidAnimeSummary(value: unknown): value is AnimeSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    Number.isFinite(Number((value as { id: unknown }).id))
  );
}

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();
    // Pull AniList edits back in (freshness-guarded) in the background so the
    // response returns on the fast local read instead of a remote GraphQL
    // round-trip; the merged result surfaces on the next read.
    after(() => {
      void syncAniListLibrary(sessionUser.id);
    });
    return NextResponse.json({
      entries: await getLibraryEntries(sessionUser.id),
    });
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

    const body = (await request.json()) as {
      anime: AnimeSummary;
      status: LibraryStatus;
      score: number;
      progress: number;
      repeat: number;
      notes: string;
      startedAt: string | null;
      completedAt: string | null;
    };
    const status = VALID_STATUSES.has(body.status) ? body.status : "planning";

    if (!isValidAnimeSummary(body.anime)) {
      return NextResponse.json({ error: "Invalid anime payload." }, { status: 400 });
    }

    const progress = clampNumber(body.progress, 0, body.anime.episodes || 10_000);
    const score = clampNumber(body.score, 0, 100);
    const repeat = clampNumber(body.repeat, 0, 99);
    const localEntry = await upsertLibraryEntry({
      userId: user.id,
      anime: body.anime,
      status,
      score,
      progress,
      repeat,
      notes: String(body.notes || "").slice(0, 5000),
      startedAt: body.startedAt,
      completedAt: body.completedAt,
    });

    // AniList is a best-effort mirror - sync it after the response is sent so
    // the client unblocks on the (fast) local write instead of a remote
    // GraphQL round-trip. after() keeps the work alive on serverless too.
    if (user.aniListAccessToken) {
      const accessToken = user.aniListAccessToken;
      after(async () => {
        try {
          const aniListEntryId = await saveAniListLibraryEntry(accessToken, {
            ...localEntry,
          });

          if (aniListEntryId) {
            await upsertLibraryEntry({
              userId: user.id,
              anime: body.anime,
              status,
              score,
              progress,
              repeat,
              notes: String(body.notes || "").slice(0, 5000),
              startedAt: body.startedAt,
              completedAt: body.completedAt,
              aniListEntryId,
            });
          }
        } catch {
          // Local write already succeeded; a failed mirror is non-fatal.
        }
      });
    }

    return NextResponse.json({
      entry: localEntry,
      syncWarning: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const sessionUser = await requireSessionUser();
    const user = await getPrivateUser(sessionUser.id);
    const { searchParams } = new URL(request.url);
    const animeId = Number(searchParams.get("animeId"));

    if (!user || !Number.isFinite(animeId)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const removed = await deleteLibraryEntry(user.id, animeId);
    let syncWarning: string | null = null;

    if (removed?.aniListEntryId && user.aniListAccessToken) {
      try {
        await deleteAniListLibraryEntry(
          user.aniListAccessToken,
          removed.aniListEntryId,
        );
      } catch (error) {
        syncWarning =
          error instanceof Error
            ? `Removed locally. AniList sync failed: ${error.message}`
            : "Removed locally. AniList sync failed.";
      }
    }

    return NextResponse.json({ ok: true, syncWarning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed." },
      { status: 400 },
    );
  }
}
