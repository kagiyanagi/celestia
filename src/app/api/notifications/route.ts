import { NextResponse } from "next/server";
import { markNotificationsRead } from "@/lib/account-store";
import { getSessionUser, requireSessionUser } from "@/lib/auth";
import { getUserNotifications } from "@/lib/notifications";

/** New-release notifications for the signed-in user's tracked anime. */
export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  try {
    const data = await getUserNotifications(user);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Notifications fetch failed", error);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

/** Marks every notification as read (a single timestamp write). */
export async function POST() {
  try {
    const user = await requireSessionUser();
    await markNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
