import type { Metadata } from "next";

import { SchedulePageShell } from "@/components/schedule-page-shell";
import { getAiringSchedule } from "@/lib/providers/anilist";
import {
  addDays,
  formatDateKey,
  getScheduleDate,
  getWeekDates,
  toEpochSeconds,
} from "@/lib/schedule";

export const metadata: Metadata = {
  title: "Schedule",
};

type SchedulePageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function SchedulePage({
  searchParams,
}: SchedulePageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedDate = getScheduleDate(params.date);
  const weekDates = getWeekDates(selectedDate);
  const weekStart = weekDates[0];
  const weekEnd = addDays(weekStart, 7);
  const items = await getAiringSchedule(
    toEpochSeconds(weekStart),
    toEpochSeconds(weekEnd),
  );
  const selectedDateKey = formatDateKey(selectedDate);

  return (
    <SchedulePageShell
      key={selectedDateKey}
      items={items}
      selectedDateKey={selectedDateKey}
      todayDateKey={formatDateKey(new Date())}
      weekDateKeys={weekDates.map(formatDateKey)}
    />
  );
}
