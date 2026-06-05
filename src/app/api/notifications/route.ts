import { NextResponse } from "next/server";
import {
  dismissNotifications,
  markNotificationsRead,
} from "@/lib/account-store";
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

/**
 * Updates notification state. Body `{ action }`:
 *  - "read-all" (default, or no body) marks everything read via a timestamp;
 *  - "read"     marks the given `ids` read;
 *  - "dismiss"  deletes the given `ids`.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      ids?: unknown;
    };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 200)
      : [];

    if (body.action === "dismiss" && ids.length > 0) {
      await dismissNotifications(user.id, ids);
    } else if (body.action === "read" && ids.length > 0) {
      await markNotificationsRead(user.id, ids);
    } else {
      await markNotificationsRead(user.id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
