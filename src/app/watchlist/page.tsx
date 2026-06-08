import { redirect } from "next/navigation";
import { WatchlistPageClient } from "@/components/watchlist-page-client";
import { getPrivateUser } from "@/lib/account-store";
import { syncAniListLibrary } from "@/lib/anilist-sync";
import { getSessionUser } from "@/lib/auth";

export default async function WatchlistPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/profile");
  }

  // Pull AniList edits in (freshness-guarded) before the first render.
  const synced = await syncAniListLibrary(sessionUser.id);
  const user = synced ?? (await getPrivateUser(sessionUser.id));

  if (!user) {
    redirect("/profile");
  }

  return <WatchlistPageClient entries={user.libraryEntries} />;
}
