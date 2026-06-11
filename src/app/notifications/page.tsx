import type { Metadata } from "next";
import { NotificationsPageShell } from "@/components/notifications-page-shell";
import { getLibraryEntries } from "@/lib/account-store";
import { getSessionUser } from "@/lib/auth";
import { getUserNotifications } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Notifications • MiruCast",
};

export default async function NotificationsPage() {
  const user = await getSessionUser();
  const data = user
    ? await getUserNotifications(user, await getLibraryEntries(user.id))
    : { notifications: [], unreadCount: 0 };

  return (
    <NotificationsPageShell
      initialNotifications={data.notifications}
      signedIn={Boolean(user)}
    />
  );
}
