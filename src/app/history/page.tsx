import { redirect } from "next/navigation";
import { HistoryPageClient } from "@/components/history-page-client";
import { getHistoryEntries } from "@/lib/account-store";
import { getSessionUser } from "@/lib/auth";

export default async function HistoryPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/profile");
  }

  const entries = await getHistoryEntries(sessionUser.id);

  return (
    <HistoryPageClient
      entries={entries}
      pauseHistory={sessionUser.preferences.pauseHistory}
    />
  );
}
