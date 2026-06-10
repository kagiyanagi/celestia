import { after } from "next/server";
import { redirect } from "next/navigation";
import { WatchlistPageClient } from "@/components/watchlist-page-client";
import { getPrivateUser } from "@/lib/account-store";
import { syncAniListLibrary } from "@/lib/anilist-sync";
import { getSessionUser } from "@/lib/auth";

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/profile");
  }

  // Render from the local library immediately; pull AniList edits in
  // (freshness-guarded) in the background so the page isn't gated on a remote
  // round-trip. Externally-made edits surface on the next navigation.
  const user = await getPrivateUser(sessionUser.id);

  if (!user) {
    redirect("/profile");
  }

  after(() => {
    void syncAniListLibrary(sessionUser.id);
  });

  const params = await searchParams;
  const single = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return (
    <WatchlistPageClient
      entries={user.libraryEntries}
      initialView={{
        tab: single(params.tab),
        sort: single(params.sort),
        order: single(params.order),
        view: single(params.view),
      }}
    />
  );
}
