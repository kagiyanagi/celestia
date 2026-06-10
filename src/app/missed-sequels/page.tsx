import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MissedSequelsPageClient } from "@/components/missed-sequels-page-client";
import { getPrivateUser } from "@/lib/account-store";
import { syncAniListLibrary } from "@/lib/anilist-sync";
import { getSessionUser, getViewerIncludesAdult } from "@/lib/auth";
import { getMissedSequels } from "@/lib/providers/anilist";

export const metadata: Metadata = {
  title: "Missed Sequels",
  description: "New seasons, sequels, and side stories of series you've watched, which are missing from your watchlist.",
};

export default async function MissedSequelsPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/profile");
  }

  // Pull AniList edits in (freshness-guarded) before rendering.
  const synced = await syncAniListLibrary(sessionUser.id);
  const user = synced ?? (await getPrivateUser(sessionUser.id));

  if (!user) {
    redirect("/profile");
  }

  const includeAdult = await getViewerIncludesAdult();
  const items = await getMissedSequels(user.libraryEntries, includeAdult);

  return <MissedSequelsPageClient initialItems={items} />;
}
