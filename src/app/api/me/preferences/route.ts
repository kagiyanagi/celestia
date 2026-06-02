import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { updatePreferences } from "@/lib/account-store";
import type { UserPreferences } from "@/types/account";

const TITLE_LANGUAGES = new Set(["english", "romaji", "native"]);
const VIDEO_QUALITIES = new Set([
  "auto",
  "higher_picture_quality",
  "data_saver",
]);

function pickPreferences(value: Partial<UserPreferences>) {
  const next: Partial<UserPreferences> = {};

  if (
    typeof value.titleLanguage === "string" &&
    TITLE_LANGUAGES.has(value.titleLanguage)
  ) {
    next.titleLanguage = value.titleLanguage;
  }

  if (
    typeof value.videoQuality === "string" &&
    VIDEO_QUALITIES.has(value.videoQuality)
  ) {
    next.videoQuality = value.videoQuality;
  }

  for (const key of [
    "hideAdultContent",
    "autoplayTrailers",
    "autoPlay",
    "autoNext",
    "autoSkipIntroOutro",
    "miniPlayer",
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
