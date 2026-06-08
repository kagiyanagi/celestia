import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { getPrivateUser, importLibraryEntries } from "@/lib/account-store";
import { getAnimeSummariesByMalIds } from "@/lib/providers/anilist";
import { parseMalExport } from "@/lib/mal-import";
import type { LibraryEntry } from "@/types/account";

// A list export can be large; guard against unbounded uploads.
const MAX_BYTES = 5_000_000;
const MAX_ENTRIES = 5_000;

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSessionUser();
    const user = await getPrivateUser(sessionUser.id);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file was uploaded." },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "That file is too large to import." },
        { status: 413 },
      );
    }

    const xml = await file.text();
    const parsed = parseMalExport(xml).slice(0, MAX_ENTRIES);

    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "No anime entries were found in that file." },
        { status: 400 },
      );
    }

    const summaries = await getAnimeSummariesByMalIds(
      parsed.map((entry) => entry.malId),
    );

    const now = new Date().toISOString();
    const entries: LibraryEntry[] = [];

    for (const entry of parsed) {
      const anime = summaries.get(entry.malId);
      if (!anime) continue;

      const progress = anime.episodes
        ? Math.min(entry.progress, anime.episodes)
        : entry.progress;

      entries.push({
        id: randomUUID(),
        animeId: anime.id,
        anime,
        status: entry.status,
        score: entry.score,
        progress,
        repeat: entry.repeat,
        notes: "",
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
        updatedAt: now,
        addedAt: now,
        aniListEntryId: null,
      });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "None of the entries could be matched to AniList." },
        { status: 400 },
      );
    }

    await importLibraryEntries(user.id, entries);

    return NextResponse.json({
      imported: entries.length,
      parsed: parsed.length,
      skipped: parsed.length - entries.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 400 },
    );
  }
}
