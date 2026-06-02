import { redirect } from "next/navigation";
import { WatchlistPageClient } from "@/components/watchlist-page-client";
import { getPrivateUser } from "@/lib/account-store";
import { getSessionUser } from "@/lib/auth";

export default async function WatchlistPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/profile");
  }

  const user = await getPrivateUser(sessionUser.id);

  if (!user) {
    redirect("/profile");
  }

  return <WatchlistPageClient entries={user.libraryEntries} />;
}
