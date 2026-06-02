import { redirect } from "next/navigation";
import { HistoryPageClient } from "@/components/history-page-client";
import { getPrivateUser } from "@/lib/account-store";
import { getSessionUser } from "@/lib/auth";

export default async function HistoryPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/profile");
  }

  const user = await getPrivateUser(sessionUser.id);

  if (!user) {
    redirect("/profile");
  }

  return <HistoryPageClient entries={user.historyEntries} />;
}
