import { applyAniListSync, getPrivateUser } from "@/lib/account-store";
import {
  getAniListViewerLibrary,
  getAniListViewerProfile,
} from "@/lib/providers/anilist";
import type { PublicUser } from "@/types/account";

// A pull at most once per minute per user keeps the read paths (library load,
// session refresh) from issuing a GraphQL round-trip on every request while
// still reflecting AniList edits near-instantly.
const SYNC_STALE_MS = 60_000;

/**
 * Pulls the user's AniList library back into Celestia so edits made directly on
 * AniList (status, progress, score, newly added/removed-from-the-tracker shows)
 * surface here. Best-effort: returns the updated user on a successful pull, or
 * null when there's nothing to do (no AniList link, recently synced, or the
 * remote call failed). Callers fall back to their existing user on null.
 */
export async function syncAniListLibrary(
  userId: string,
  options: { force?: boolean } = {},
): Promise<PublicUser | null> {
  const user = await getPrivateUser(userId);

  if (!user?.aniListAccessToken) {
    return null;
  }

  if (!options.force && user.aniListSyncedAt) {
    const age = Date.now() - new Date(user.aniListSyncedAt).getTime();
    if (Number.isFinite(age) && age < SYNC_STALE_MS) {
      return null;
    }
  }

  try {
    const token = user.aniListAccessToken;
    const profile = await getAniListViewerProfile(token);
    const libraryEntries = await getAniListViewerLibrary(token, profile.id);
    return await applyAniListSync({ userId, profile, libraryEntries });
  } catch {
    // Sync is non-essential; a failed pull must never break the page.
    return null;
  }
}
