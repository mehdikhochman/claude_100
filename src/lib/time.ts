// Time helpers.
//
// Rule of the house: the database stores UTC, people see studio time.
// STUDIO_TIMEZONE (default Africa/Abidjan) decides what "studio time" is.
// We only use the built-in Intl API — no date library.
import { getStudioTimezone } from "./env";

export const HOUR_MS = 60 * 60 * 1000;

/** Locale used for all user-facing dates (English, day-first). */
const LOCALE = "en-GB";

function tz(): string {
  return getStudioTimezone();
}

/** "Friday 3 Jul · 07:00" — the standard way a session time is shown. */
export function formatSessionTime(date: Date): string {
  return `${formatDayShort(date)} · ${formatTime(date)}`;
}

/** "Friday 3 Jul" */
export function formatDayShort(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: tz(),
  }).format(date);
}

/** "Friday 3 July 2026" — used for day headings on the schedule. */
export function formatDayLong(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz(),
  }).format(date);
}

/** "07:00" (24h clock). */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz(),
  }).format(date);
}

/** "3 Jul 2026, 07:00" — compact, for admin tables and audit logs. */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz(),
  }).format(date);
}

/** Calendar parts of an instant, as seen in the studio timezone. */
export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  weekday: number; // 0 = Sunday ... 6 = Saturday
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getZonedParts(date: Date, timeZone: string = tz()): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  }).formatToParts(date);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour: Number(pick("hour")) % 24,
    minute: Number(pick("minute")),
    second: Number(pick("second")),
    weekday: WEEKDAYS.indexOf(pick("weekday")),
  };
}

/** Offset (ms) of the timezone at the given instant: zoned wall clock minus UTC. */
function offsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock time in the studio timezone into a UTC instant.
 * Example: { 2026, 7, 3, 7, 0 } in Africa/Abidjan -> 2026-07-03T07:00:00Z.
 * Works for any IANA zone (two passes handle daylight-saving edges).
 */
export function zonedTimeToUtc(
  input: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string = tz(),
): Date {
  const guess = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute);
  const firstOffset = offsetMs(new Date(guess), timeZone);
  let result = guess - firstOffset;
  const secondOffset = offsetMs(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = guess - secondOffset;
  return new Date(result);
}

/** "YYYY-MM-DD" in studio time — used to group sessions by day. */
export function studioDayKey(date: Date): string {
  const p = getZonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Value for an <input type="datetime-local"> showing the studio wall-clock time. */
export function toDateTimeLocalValue(date: Date): string {
  const p = getZonedParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Parse an <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm"), typed in
 * studio time, into a UTC Date. Returns null when malformed.
 */
export function parseDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const date = zonedTimeToUtc({ year: y, month: mo, day: d, hour: h, minute: mi });
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Start of "today" in studio time, as a UTC instant. */
export function startOfStudioDay(date: Date = new Date()): Date {
  const p = getZonedParts(date);
  return zonedTimeToUtc({ year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 });
}

/** Add whole days to a studio wall-clock date (handles month boundaries via Date.UTC). */
export function addStudioDays(dayKeyDate: Date, days: number): Date {
  const p = getZonedParts(dayKeyDate);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return zonedTimeToUtc({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: p.hour,
    minute: p.minute,
  });
}

/** "Today" / "Tomorrow" / "Friday 3 July 2026" for schedule day headings. */
export function relativeDayLabel(date: Date, now: Date = new Date()): string {
  const key = studioDayKey(date);
  if (key === studioDayKey(now)) return "Today";
  if (key === studioDayKey(addStudioDays(now, 1))) return "Tomorrow";
  return formatDayLong(date);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
