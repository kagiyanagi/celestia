import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { updatePreferences } from "@/lib/account-store";
import type { UserPreferences } from "@/types/account";

const TITLE_LANGUAGES = new Set(["english", "romaji", "native"]);
const AUDIO_TRACKS = new Set(["sub", "dub"]);

function pickPreferences(value: Partial<UserPreferences>) {
  const next: Partial<UserPreferences> = {};

  if (
    typeof value.titleLanguage === "string" &&
    TITLE_LANGUAGES.has(value.titleLanguage)
  ) {
    next.titleLanguage = value.titleLanguage;
  }

  if (
    typeof value.defaultAudio === "string" &&
    AUDIO_TRACKS.has(value.defaultAudio)
  ) {
    next.defaultAudio = value.defaultAudio;
  }

  for (const key of [
    "hideAdultContent",
    "autoplayTrailers",
    "pauseHistory",
    "notifyEpisodes",
    "notifyDubs",
    "notifyUpcoming",
    "publicProfile",
  ] as const) {
    if (typeof value[key] === "boolean") {
      next[key] = value[key];
    }
  }

  return next;
}

export async function PATCH(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = (await request.json()) as Partial<UserPreferences>;
    const nextUser = await updatePreferences(user.id, pickPreferences(body));
    return NextResponse.json({ user: nextUser });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Preference update failed.",
      },
      { status: 400 },
    );
  }
}
