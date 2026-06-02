const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string | undefined): Date | null {
  if (!value || !DATE_KEY_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return formatDateKey(date) === value ? date : null;
}

export function getScheduleDate(value: string | undefined): Date {
  return parseDateKey(value) || startOfDay(new Date());
}

export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return addDays(day, -day.getDay());
}

export function getWeekDates(date: Date): Date[] {
  const start = startOfWeek(date);

  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function toEpochSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function getNextWeekendDate(date: Date): Date {
  const today = startOfDay(date);
  const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;

  return addDays(today, daysUntilSaturday);
}
