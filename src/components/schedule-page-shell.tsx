"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BadgeAlert,
  Check,
  ChevronRight,
  ListChecks,
  Mic,
  Radio,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AiringCountdown } from "@/components/airing-countdown";
import { useAuth } from "@/components/auth-provider";
import { useBannerContext } from "@/components/banner-fallback-provider";
import { DubBadge } from "@/components/dub-badge";
import { useDubCounts } from "@/components/dub-badge-provider";
import { getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import {
  addDays,
  formatDateKey,
  getNextWeekendDate,
  parseDateKey,
} from "@/lib/schedule";
import type { AiringItem } from "@/types/anime";

type SchedulePageShellProps = {
  items: AiringItem[];
  selectedDateKey: string;
  todayDateKey: string;
  weekDateKeys: string[];
};

type TimelineGroup = {
  hour: string;
  items: AiringItem[];
};

const dayFormatter = new Intl.DateTimeFormat("en", { weekday: "long" });
const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});
const spotlightIcons = [Check, BadgeAlert, Sparkles];

function scheduleHref(dateKey: string): string {
  return `/schedule?date=${dateKey}`;
}

function getAiringDateKey(item: AiringItem): string {
  return formatDateKey(new Date(item.airingAt * 1000));
}

function entryKey(item: AiringItem): string {
  return `${item.anime.id}-${item.episode}-${item.airingAt}`;
}

// Describes a tracked show's standing against the episode airing this slot, from
// the user's library progress: already seen, how many episodes behind, or just
// "on your list" when they're current (progress sits at the previous episode).
function trackedStatusFor(
  progress: number,
  episode: number,
): { label: string; variant: string } {
  if (progress >= episode) {
    return { label: "Watched", variant: " is-watched" };
  }

  const behind = episode - 1 - progress;
  if (behind > 0) {
    return { label: `${behind} behind`, variant: " is-behind" };
  }

  return { label: "On your list", variant: "" };
}

function formatClockTime(epochSeconds: number, paddedHour = false): string {
  const date = new Date(epochSeconds * 1000);
  const hour = paddedHour
    ? String(date.getHours()).padStart(2, "0")
    : String(date.getHours());
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${hour}:${minute}`;
}

function getHourLabel(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function getTimelineGroups(items: AiringItem[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];

  items.forEach((item) => {
    const hour = getHourLabel(item.airingAt);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.hour === hour) {
      lastGroup.items.push(item);
      return;
    }

    groups.push({ hour, items: [item] });
  });

  return groups;
}

export function SchedulePageShell({
  items,
  selectedDateKey,
  todayDateKey,
  weekDateKeys,
}: SchedulePageShellProps) {
  const titleLanguage = useTitleLanguage();
  const [activeDateKey, setActiveDateKey] = useState(selectedDateKey);

  // A shared wall clock drives the "aired vs upcoming" split and the next-up
  // marker. Null until mounted so the server and first client render agree
  // (both fall back to the provider-supplied timeUntilAiring).
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowSeconds(Math.floor(Date.now() / 1000));
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const hasAired = (item: AiringItem): boolean =>
    nowSeconds === null
      ? item.timeUntilAiring <= 0
      : item.airingAt <= nowSeconds;

  // The signed-in user's tracked library is available client-side via useAuth,
  // so "from your list" filtering needs no extra request.
  const { user } = useAuth();
  const trackedIds = useMemo(
    () => new Set((user?.libraryEntries ?? []).map((entry) => entry.animeId)),
    [user],
  );
  const trackedProgress = useMemo(
    () =>
      new Map(
        (user?.libraryEntries ?? []).map((entry) => [
          entry.animeId,
          entry.progress,
        ]),
      ),
    [user],
  );
  const isTracked = (item: AiringItem): boolean =>
    trackedIds.has(item.anime.id);
  const [mineOnly, setMineOnly] = useState(false);
  const canFilterMine = trackedIds.size > 0;
  const filterMine = mineOnly && canFilterMine;

  const [dubbedOnly, setDubbedOnly] = useState(false);

  // Resolves the tracked-status pill for a card; null when the show is untracked
  // or when the redundant "on your list" pill would just repeat the active
  // "from your list" filter.
  const statusFor = (
    item: AiringItem,
  ): { label: string; variant: string } | null => {
    if (!isTracked(item)) {
      return null;
    }
    const status = trackedStatusFor(
      trackedProgress.get(item.anime.id) ?? 0,
      item.episode,
    );
    if (status.variant === "" && filterMine) {
      return null;
    }
    return status;
  };

  // Backdrops AniList is missing resolve client-side, off the render path.
  const bannerCtx = useBannerContext();
  useEffect(() => {
    items.forEach((item) => {
      if (!item.anime.bannerImage) {
        bannerCtx?.register(item.anime.id);
      }
    });
  }, [items, bannerCtx]);
  const bannerFor = (item: AiringItem): string | null =>
    item.anime.bannerImage ?? bannerCtx?.banners.get(item.anime.id) ?? null;

  const activeDate = parseDateKey(activeDateKey) || new Date();
  const todayDate = parseDateKey(todayDateKey) || new Date();
  const selectedItems = items.filter(
    (item) => getAiringDateKey(item) === activeDateKey,
  );
  const trackedCount = selectedItems.filter(isTracked).length;
  // Dub counts hydrate client-side (mirrors the browse grid's "dubbed only").
  // Only register the day's ids for lookup when the filter is engaged.
  const dubCounts = useDubCounts(
    dubbedOnly ? selectedItems.map((item) => item.anime.id) : [],
  );
  const hasDub = (item: AiringItem): boolean =>
    (dubCounts.get(item.anime.id) ?? 0) > 0;
  let displayItems = filterMine
    ? selectedItems.filter(isTracked)
    : selectedItems;
  if (dubbedOnly) {
    displayItems = displayItems.filter(hasDub);
  }
  const timelineGroups = getTimelineGroups(displayItems);
  const spotlightItems = displayItems.slice(0, 3);
  // The chronologically-first not-yet-aired episode of the selected day is the
  // "next up" — sorted order is guaranteed upstream, so the first match wins.
  const nextUpItem = displayItems.find((item) => !hasAired(item)) ?? null;
  const nextUpKey = nextUpItem ? entryKey(nextUpItem) : null;
  const rangeButtons = [
    {
      label: "Yesterday",
      dateKey: formatDateKey(addDays(todayDate, -1)),
    },
    {
      label: "Today",
      dateKey: todayDateKey,
    },
    {
      label: "Tomorrow",
      dateKey: formatDateKey(addDays(todayDate, 1)),
    },
    {
      label: "Previous week",
      dateKey: formatDateKey(addDays(activeDate, -7)),
    },
    {
      label: "Next weekend",
      dateKey: formatDateKey(getNextWeekendDate(todayDate)),
    },
  ];

  return (
    <div className="schedule-shell">
      <div className="schedule-toolbar">
        <p className="schedule-summary">
          <strong>{selectedItems.length}</strong>{" "}
          {selectedItems.length === 1 ? "episode" : "episodes"} airing
          {trackedCount > 0 && (
            <>
              {" · "}
              <span className="schedule-summary-mine">
                {trackedCount} from your list
              </span>
            </>
          )}
        </p>
        <div className="schedule-toggles">
          {canFilterMine && (
            <button
              type="button"
              className={`schedule-toggle${filterMine ? " active" : ""}`}
              aria-pressed={filterMine}
              onClick={() => setMineOnly((value) => !value)}
            >
              <ListChecks size={15} aria-hidden />
              From your list
            </button>
          )}
          <button
            type="button"
            className={`schedule-toggle${dubbedOnly ? " active" : ""}`}
            aria-pressed={dubbedOnly}
            onClick={() => setDubbedOnly((value) => !value)}
          >
            <Mic size={15} aria-hidden />
            Dubbed
          </button>
        </div>
      </div>

      <section className="schedule-spotlight" aria-label="Featured releases">
        {spotlightItems.length ? (
          spotlightItems.map((item, index) => {
            const title = getDisplayTitle(item.anime.title, titleLanguage);
            const Icon = spotlightIcons[index % spotlightIcons.length];
            const status = statusFor(item);

            return (
              <Link
                className="schedule-spotlight-card"
                href={`/anime/${item.anime.id}`}
                key={`${item.anime.id}-${item.episode}-${item.airingAt}`}
              >
                {bannerFor(item) && (
                  <Image
                    src={bannerFor(item) as string}
                    alt=""
                    fill
                    sizes="(max-width: 780px) 100vw, 33vw"
                    className="schedule-card-bg-image"
                  />
                )}
                <span className="schedule-card-shade" />
                <span className="schedule-corner-badge">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="schedule-spotlight-copy">
                  <strong>{title}</strong>
                  <span>
                    <b>EP {item.episode}</b>
                    <b>{formatClockTime(item.airingAt)}</b>
                    <b className="schedule-countdown">
                      {hasAired(item) ? (
                        "Aired"
                      ) : (
                        <AiringCountdown
                          airingAt={item.airingAt}
                          fallbackSeconds={item.timeUntilAiring}
                        />
                      )}
                    </b>
                    <DubBadge
                      animeId={item.anime.id}
                      className="schedule-dub-tag"
                      withTitle
                    />
                    {status && (
                      <b className={`schedule-tracked-tag${status.variant}`}>
                        {status.label}
                      </b>
                    )}
                  </span>
                </span>
                {item.anime.coverImage && (
                  <span className="schedule-spotlight-poster">
                    <Image
                      src={item.anime.coverImage}
                      alt={`${title} poster`}
                      fill
                      sizes="90px"
                      className="poster-image"
                    />
                  </span>
                )}
              </Link>
            );
          })
        ) : (
          <div className="empty-panel">No featured releases for this day.</div>
        )}
      </section>

      <nav className="schedule-jumpbar" aria-label="Schedule date shortcuts">
        {rangeButtons.map((button) => (
          <Link
            className={button.dateKey === activeDateKey ? "active" : undefined}
            href={scheduleHref(button.dateKey)}
            key={button.label}
          >
            {button.label}
          </Link>
        ))}
      </nav>

      <section className="schedule-week" aria-label="Select day of week">
        {weekDateKeys.map((dateKey, index) => {
          const date = parseDateKey(dateKey) || new Date();
          const isActive = dateKey === activeDateKey;

          return (
            <span className="schedule-day-segment" key={dateKey}>
              <button
                className={isActive ? "active" : undefined}
                type="button"
                onClick={() => setActiveDateKey(dateKey)}
                aria-pressed={isActive}
              >
                <strong>{dayFormatter.format(date)}</strong>
                <small>{dateFormatter.format(date)}</small>
              </button>
              {index < weekDateKeys.length - 1 && <i aria-hidden>/</i>}
            </span>
          );
        })}
      </section>

      <section className="schedule-timeline" aria-label="Airing schedule">
        {timelineGroups.length ? (
          timelineGroups.map((group) => (
            <div className="schedule-hour-group" key={group.hour}>
              <div className="schedule-hour-heading">
                <ChevronRight size={24} aria-hidden />
                <h2>{group.hour}</h2>
              </div>
              <div className="schedule-hour-track">
                {group.items.map((item) => {
                  const title = getDisplayTitle(item.anime.title, titleLanguage);
                  const key = entryKey(item);
                  const aired = hasAired(item);
                  const isNext = key === nextUpKey;
                  const status = statusFor(item);

                  return (
                    <Link
                      className={`schedule-entry-card${aired ? " is-aired" : ""}${
                        isNext ? " is-next" : ""
                      }`}
                      href={`/anime/${item.anime.id}`}
                      key={key}
                    >
                      {bannerFor(item) && (
                        <Image
                          src={bannerFor(item) as string}
                          alt=""
                          fill
                          sizes="(max-width: 780px) 100vw, 34vw"
                          className="schedule-card-bg-image"
                        />
                      )}
                      <span className="schedule-card-shade" />
                      <span className="schedule-entry-poster">
                        {item.anime.coverImage ? (
                          <Image
                            src={item.anime.coverImage}
                            alt={`${title} poster`}
                            fill
                            sizes="72px"
                            className="poster-image"
                          />
                        ) : (
                          <span>CL</span>
                        )}
                      </span>
                      <span className="schedule-entry-copy">
                        <strong>{title}</strong>
                        <span className="schedule-entry-tags">
                          <b>EP {item.episode}</b>
                          <DubBadge
                            animeId={item.anime.id}
                            className="schedule-dub-tag"
                            withTitle
                          />
                          {isNext && <b className="schedule-next-tag">Next up</b>}
                          {status && (
                            <b className={`schedule-tracked-tag${status.variant}`}>
                              {status.label}
                            </b>
                          )}
                        </span>
                      </span>
                      <span className="schedule-entry-meta">
                        <span className="schedule-entry-time">
                          {formatClockTime(item.airingAt, true)}
                        </span>
                        <span
                          className={`schedule-countdown${hasAired(item) ? " is-aired" : ""}`}
                        >
                          {hasAired(item) ? (
                            "Aired"
                          ) : (
                            <AiringCountdown
                              airingAt={item.airingAt}
                              fallbackSeconds={item.timeUntilAiring}
                            />
                          )}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-panel">
            {filterMine && selectedItems.length > 0
              ? `None of your tracked shows air on ${dayFormatter.format(activeDate)}.`
              : `No airing entries found for ${dayFormatter.format(activeDate)}.`}
          </div>
        )}
      </section>

      <div className="schedule-footnote">
        <Radio size={15} aria-hidden />
        Times are shown in your local timezone.
      </div>
    </div>
  );
}
