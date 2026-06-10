import { NextResponse } from "next/server";

import { getLibraryEntries } from "@/lib/account-store";
import { getSessionUser } from "@/lib/auth";
import { getCachedUserNotifications } from "@/lib/notifications";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ unreadCount: 0 });
  }

  try {
    const library = await getLibraryEntries(user.id);
    const data = await getCachedUserNotifications(user, library);
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
