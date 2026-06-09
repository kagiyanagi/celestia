import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { toggleFavorite } from "@/lib/account-store";
import type { FavoriteKind } from "@/types/account";

const KINDS = new Set<FavoriteKind>(["anime", "character", "voice_actor"]);

export async function POST(request: Request) {
  try {
    const sessionUser = await requireSessionUser();
    const body = (await request.json()) as {
      kind?: string;
      id?: unknown;
      name?: unknown;
      image?: unknown;
    };

    if (
      !KINDS.has(body.kind as FavoriteKind) ||
      typeof body.id !== "number" ||
      typeof body.name !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid favourite." },
        { status: 400 },
      );
    }

    const user = await toggleFavorite(sessionUser.id, {
      kind: body.kind as FavoriteKind,
      id: body.id,
      name: body.name.slice(0, 200),
      image: typeof body.image === "string" ? body.image : null,
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update favourites.",
      },
      { status: 400 },
    );
  }
}
