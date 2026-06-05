"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeAlert, Check, ChevronRight, Radio, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { useBannerContext } from "@/components/banner-fallback-provider";
import { getDisplayTitle } from "@/lib/format";
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
  const [activeDateKey, setActiveDateKey] = useState(selectedDateKey);

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
  const timelineGroups = getTimelineGroups(selectedItems);
  const spotlightItems = selectedItems.slice(0, 3);
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
      <section className="schedule-spotlight" aria-label="Featured releases">
        {spotlightItems.length ? (
          spotlightItems.map((item, index) => {
            const title = getDisplayTitle(item.anime.title);
            const Icon = spotlightIcons[index % spotlightIcons.length];

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
                  const title = getDisplayTitle(item.anime.title);

                  return (
                    <Link
                      className="schedule-entry-card"
                      href={`/anime/${item.anime.id}`}
                      key={`${item.anime.id}-${item.episode}-${item.airingAt}`}
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
                        <b>EP {item.episode}</b>
                      </span>
                      <span className="schedule-entry-time">
                        {formatClockTime(item.airingAt, true)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-panel">
            No airing entries found for {dayFormatter.format(activeDate)}.
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
