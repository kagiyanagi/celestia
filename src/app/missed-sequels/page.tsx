import type { Metadata } from "next";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { MissedSequelsPageClient } from "@/components/missed-sequels-page-client";
import { getLibraryEntries } from "@/lib/account-store";
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

  // Compute from the local library immediately; pull AniList edits in
  // (freshness-guarded) in the background rather than gating render on a remote
  // round-trip. A newly-completed show surfaces its sequels on the next visit.
  const library = await getLibraryEntries(sessionUser.id);

  after(() => {
    void syncAniListLibrary(sessionUser.id);
  });

  const includeAdult = await getViewerIncludesAdult();
  const items = await getMissedSequels(library, includeAdult);

  return <MissedSequelsPageClient initialItems={items} />;
}
