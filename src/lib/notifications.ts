import { withSoftTimeout } from "@/lib/async";
import { getDisplayTitle } from "@/lib/format";
import {
  getRecentEpisodeDrops,
  getUpcomingEpisodes,
} from "@/lib/providers/anilist";
import { getRecentDubDrops } from "@/lib/providers/anime-schedule";
import type { LibraryStatus, PublicUser } from "@/types/account";
import type { AnimeNotification } from "@/types/anime";

// How far back a release still counts as "new".
const WINDOW_DAYS = 30;
// How far ahead an episode counts as "airing soon".
const UPCOMING_WINDOW_SECONDS = 24 * 60 * 60;
// Bound provider fan-out for very large libraries.
const MAX_TRACKED = 150;
const MAX_NOTIFICATIONS = 60;
const NOTIFICATION_CACHE_TTL_MS = 60_000;

type NotificationPayload = {
  notifications: AnimeNotification[];
  unreadCount: number;
};

type NotificationCacheEntry = {
  payload: NotificationPayload;
  expiresAt: number;
};

const notificationCache = new Map<string, NotificationCacheEntry>();

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

function getNotificationCacheKey(user: PublicUser): string {
  const libraryVersion = (user.libraryEntries || [])
    .map((entry) => `${entry.animeId}:${entry.status}:${entry.updatedAt}`)
    .join(",");

  return [
    user.id,
    user.preferences.titleLanguage,
    `${user.preferences.notifyEpisodes !== false ? 1 : 0}${
      user.preferences.notifyDubs !== false ? 1 : 0
    }${user.preferences.notifyUpcoming !== false ? 1 : 0}`,
    (user.mutedAnimeIds ?? []).join(","),
    user.notificationsLastReadAt ?? "",
    (user.notificationReadIds ?? []).join(","),
    (user.notificationDismissedIds ?? []).join(","),
    libraryVersion,
  ].join("|");
}

export function clearUserNotificationCache(userId: string) {
  notificationCache.forEach((_entry, key) => {
    if (key.startsWith(`${userId}|`)) {
      notificationCache.delete(key);
    }
  });
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
): Promise<NotificationPayload> {
  const mutedIds = new Set(user.mutedAnimeIds ?? []);
  const tracked = (user.libraryEntries || []).filter(
    (entry) =>
      NOTIFY_STATUSES.has(entry.status) && !mutedIds.has(entry.animeId),
  );
  if (tracked.length === 0) {
    return { notifications: [], unreadCount: 0 };
  }

  // Undefined (older records) defaults to enabled; only an explicit false opts out.
  const notifyEpisodes = user.preferences.notifyEpisodes !== false;
  const notifyDubs = user.preferences.notifyDubs !== false;
  const notifyUpcoming = user.preferences.notifyUpcoming !== false;

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

  const [subDrops, dubDrops, upcoming] = await Promise.all([
    notifyEpisodes
      ? withSoftTimeout(getRecentEpisodeDrops(ids, since), 6_000, [])
      : Promise.resolve([]),
    notifyDubs
      ? withSoftTimeout(
          getRecentDubDrops(
            limited.map((entry) => ({
              animeId: entry.animeId,
              anime: entry.anime,
            })),
            since,
          ),
          5_000,
          [],
        )
      : Promise.resolve([]),
    notifyUpcoming
      ? withSoftTimeout(getUpcomingEpisodes(ids, UPCOMING_WINDOW_SECONDS), 6_000, [])
      : Promise.resolve([]),
  ]);

  const notifications: AnimeNotification[] = [];

  for (const drop of upcoming) {
    const id = `${drop.animeId}:upcoming:${drop.episode}`;
    if (dismissedIds.has(id)) continue;
    notifications.push({
      id,
      type: "upcoming",
      animeId: drop.animeId,
      title: getDisplayTitle(drop.anime.title, user.preferences.titleLanguage),
      coverImage: drop.anime.coverImage ?? null,
      episode: drop.episode,
      airedAt: drop.airedAt,
      // airedAt is in the future, so the plain airedAt <= lastReadAt check
      // can't apply. A reminder first becomes visible when it enters the
      // upcoming window (airedAt - window); if the user marked all read after
      // that, they've seen it. Newer arrivals stay unread.
      read:
        readIds.has(id) ||
        lastReadAt >= drop.airedAt - UPCOMING_WINDOW_SECONDS,
    });
  }

  for (const drop of subDrops) {
    const id = `${drop.animeId}:sub:${drop.episode}`;
    if (dismissedIds.has(id)) continue;
    if (drop.airedAt < (trackedSinceById.get(drop.animeId) ?? 0)) continue;
    notifications.push({
      id,
      type: "episode",
      animeId: drop.animeId,
      title: getDisplayTitle(drop.anime.title, user.preferences.titleLanguage),
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
      title: getDisplayTitle(anime?.title, user.preferences.titleLanguage),
      coverImage: anime?.coverImage ?? null,
      episode: drop.episode,
      airedAt: drop.airedAt,
      read: drop.airedAt <= lastReadAt || readIds.has(id),
    });
  }

  const grouped = groupNotifications(notifications, readIds, dismissedIds);
  grouped.sort((a, b) => b.airedAt - a.airedAt);
  const unreadCount = grouped.filter((notification) => !notification.read)
    .length;

  return {
    notifications: grouped.slice(0, MAX_NOTIFICATIONS),
    unreadCount,
  };
}

/**
 * Collapses multiple drops of the same show + type (e.g. a binge release of
 * episodes 5–7) into one notice with an episode range, so a single catch-up
 * doesn't bury the rest of the list. The id stays deterministic
 * (`animeId:type:min-max`) so read/dismiss survive a re-group; a group is read
 * only when every member is, and carries the most recent airedAt.
 */
function groupNotifications(
  notifications: AnimeNotification[],
  readIds: Set<string>,
  dismissedIds: Set<string>,
): AnimeNotification[] {
  const groups = new Map<string, AnimeNotification[]>();
  for (const notification of notifications) {
    const key = `${notification.animeId}:${notification.type}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(notification);
    } else {
      groups.set(key, [notification]);
    }
  }

  const result: AnimeNotification[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      result.push(bucket[0]);
      continue;
    }
    const episodes = bucket.map((item) => item.episode);
    const minEpisode = Math.min(...episodes);
    const maxEpisode = Math.max(...episodes);
    const first = bucket[0];
    // Synthetic id is what read/dismiss target, so honor it here too —
    // otherwise acting on a group wouldn't stick once it's re-grouped.
    const groupId = `${first.animeId}:${first.type}:${minEpisode}-${maxEpisode}`;
    if (dismissedIds.has(groupId)) {
      continue;
    }
    result.push({
      ...first,
      id: groupId,
      episode: minEpisode,
      episodeTo: maxEpisode > minEpisode ? maxEpisode : undefined,
      airedAt: Math.max(...bucket.map((item) => item.airedAt)),
      read: readIds.has(groupId) || bucket.every((item) => item.read),
    });
  }
  return result;
}

export async function getCachedUserNotifications(
  user: PublicUser,
): Promise<NotificationPayload> {
  const key = getNotificationCacheKey(user);
  const cached = notificationCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const payload = await getUserNotifications(user);
  notificationCache.set(key, {
    payload,
    expiresAt: Date.now() + NOTIFICATION_CACHE_TTL_MS,
  });

  return payload;
}
