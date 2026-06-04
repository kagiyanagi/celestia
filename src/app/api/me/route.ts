import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { getPrivateUser, updateProfile } from "@/lib/account-store";

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();
    const user = await getPrivateUser(sessionUser.id);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        pronouns: user.pronouns,
        about: user.about,
        avatar: user.avatar,
        banner: user.banner,
        joinedAt: user.joinedAt,
        aniListProfile: user.aniListProfile,
        preferences: user.preferences,
        devices: user.devices,
        libraryEntries: user.libraryEntries,
        historyEntries: user.historyEntries,
        notificationsLastReadAt: user.notificationsLastReadAt ?? null,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireSessionUser();
    const body = (await request.json()) as {
      displayName?: string;
      username?: string;
      pronouns?: string;
      about?: string;
    };

    const user = await updateProfile(sessionUser.id, body);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile update failed." },
      { status: 400 },
    );
  }
}
