import { NextResponse } from "next/server";
import { clearSession, requireSessionUser } from "@/lib/auth";
import { deleteAccount, getPublicUser, updateProfile } from "@/lib/account-store";

export async function GET() {
  try {
    const sessionUser = await requireSessionUser();
    const user = await getPublicUser(sessionUser.id);

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user });
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

export async function DELETE() {
  try {
    const sessionUser = await requireSessionUser();
    await clearSession();
    await deleteAccount(sessionUser.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Account deletion failed." },
      { status: 400 },
    );
  }
}
