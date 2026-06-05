import { withSoftTimeout } from "@/lib/async";
import { getDisplayTitle } from "@/lib/format";
import { getRecentEpisodeDrops } from "@/lib/providers/anilist";
import { getRecentDubDrops } from "@/lib/providers/anime-schedule";
import type { LibraryStatus, PublicUser } from "@/types/account";
import type { AnimeNotification } from "@/types/anime";

// How far back a release still counts as "new".
const WINDOW_DAYS = 30;
// Bound provider fan-out for very large libraries.
const MAX_TRACKED = 150;
const MAX_NOTIFICATIONS = 60;

// Statuses worth notifying about — exclude dropped/completed shows.
const NOTIFY_STATUSES = new Set<LibraryStatus>([
  "watching",
  "rewatching",
  "planning",
  "on_hold",
]);

/** Epoch seconds a tracked entry started counting for notifications. */
function trackedSince(entry: { addedAt?: string | null; updatedAt: string }) {
  // Pre-existing entries have no addedAt; updatedAt is the best approximation
  // of when the user started caring about the show.
  const iso = entry.addedAt || entry.updatedAt;
  const epoch = iso ? Math.floor(Date.parse(iso) / 1000) : 0;
  return Number.isFinite(epoch) ? epoch : 0;
}

/**
 * Builds new-release notifications for a user's tracked anime: subbed episode
 * drops (AniList airing schedule) and dub episode drops (AnimeSchedule), within
 * the recent window. Only episodes that aired after the anime was added to the
 * list count, so tracking a show never backfills its whole recent history. Read
 * state combines notificationsLastReadAt (mark-all) with per-id reads, and
 * dismissed ids are hidden. Nothing is fabricated — only episodes the providers
 * report as aired appear.
 */
export async function getUserNotifications(
  user: PublicUser,
): Promise<{ notifications: AnimeNotification[]; unreadCount: number }> {
  const tracked = (user.libraryEntries || []).filter((entry) =>
    NOTIFY_STATUSES.has(entry.status),
  );
  if (tracked.length === 0) {
    return { notifications: [], unreadCount: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const since = now - WINDOW_DAYS * 86_400;
  const lastReadAt = user.notificationsLastReadAt
    ? Math.floor(Date.parse(user.notificationsLastReadAt) / 1000)
    : 0;
  const readIds = new Set(user.notificationReadIds ?? []);
  const dismissedIds = new Set(user.notificationDismissedIds ?? []);

  const limited = tracked.slice(0, MAX_TRACKED);
  const ids = limited.map((entry) => entry.animeId);
  const animeById = new Map(limited.map((entry) => [entry.animeId, entry.anime]));
  // Per-anime cutoff: a drop only counts once the show is on the user's list.
  const trackedSinceById = new Map(
    limited.map((entry) => [entry.animeId, trackedSince(entry)]),
  );

  const [subDrops, dubDrops] = await Promise.all([
    withSoftTimeout(getRecentEpisodeDrops(ids, since), 6_000, []),
    withSoftTimeout(
      getRecentDubDrops(
        limited.map((entry) => ({ animeId: entry.animeId, anime: entry.anime })),
        since,
      ),
      5_000,
      [],
    ),
  ]);

  const notifications: AnimeNotification[] = [];

  for (const drop of subDrops) {
    const id = `${drop.animeId}:sub:${drop.episode}`;
    if (dismissedIds.has(id)) continue;
    if (drop.airedAt < (trackedSinceById.get(drop.animeId) ?? 0)) continue;
    notifications.push({
      id,
      type: "episode",
      animeId: drop.animeId,
      title: getDisplayTitle(drop.anime.title),
      coverImage: drop.anime.coverImage ?? null,
      episode: drop.episode,
      airedAt: drop.airedAt,
      read: drop.airedAt <= lastReadAt || readIds.has(id),
    });
  }

  for (const drop of dubDrops) {
    const id = `${drop.animeId}:dub:${drop.episode}`;
    if (dismissedIds.has(id)) continue;
    if (drop.airedAt < (trackedSinceById.get(drop.animeId) ?? 0)) continue;
    const anime = animeById.get(drop.animeId);
    notifications.push({
      id,
      type: "dub",
      animeId: drop.animeId,
      title: getDisplayTitle(anime?.title),
      coverImage: anime?.coverImage ?? null,
      episode: drop.episode,
      airedAt: drop.airedAt,
      read: drop.airedAt <= lastReadAt || readIds.has(id),
    });
  }

  notifications.sort((a, b) => b.airedAt - a.airedAt);
  const unreadCount = notifications.filter((notification) => !notification.read)
    .length;

  return {
    notifications: notifications.slice(0, MAX_NOTIFICATIONS),
    unreadCount,
  };
}
