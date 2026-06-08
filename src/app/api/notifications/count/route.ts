import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getCachedUserNotifications } from "@/lib/notifications";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ unreadCount: 0 });
  }

  try {
    const data = await getCachedUserNotifications(user);
    return NextResponse.json(
      { unreadCount: data.unreadCount },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  } catch (error) {
    console.error("Notification count failed", error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
