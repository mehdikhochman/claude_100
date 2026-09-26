// Numbers and small chart data for the admin overview.
// All queries are plain Prisma; nothing here is cached.
import { prisma } from "../db";
import { getZonedParts, startOfStudioDay, addStudioDays, studioDayKey } from "../time";

export type OverviewStats = {
  totalMembers: number;
  classesOffered: number;
  upcomingSessions: number;
  confirmedBookings: number;
  unpaidUpcoming: number;
  waitlisted: number;
};

export async function getOverviewStats(now = new Date()): Promise<OverviewStats> {
  const [totalMembers, classesOffered, upcomingSessions, confirmedBookings, unpaidUpcoming, waitlisted] =
    await Promise.all([
      prisma.user.count({ where: { role: "MEMBER" } }),
      prisma.studioClass.count({ where: { isArchived: false } }),
      prisma.session.count({ where: { startsAt: { gte: now } } }),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      // Cash still to collect: confirmed, not paid, session not yet started.
      prisma.booking.count({ where: { status: "CONFIRMED", isPaid: false, session: { startsAt: { gte: now } } } }),
      prisma.booking.count({ where: { status: "WAITLISTED", session: { startsAt: { gte: now } } } }),
    ]);
  return { totalMembers, classesOffered, upcomingSessions, confirmedBookings, unpaidUpcoming, waitlisted };
}

export type TrendPoint = { dayKey: string; label: string; perClass: Record<string, number>; total: number };
export type AttendanceTrend = { classNames: string[]; points: TrendPoint[] };

/**
 * Confirmed bookings per class per studio day, for a window of days around
 * today (past `daysBack` days and next `daysAhead` days). Powers the trend chart.
 */
export async function getAttendanceTrend(daysBack = 7, daysAhead = 7, now = new Date()): Promise<AttendanceTrend> {
  const today = startOfStudioDay(now);
  const from = addStudioDays(today, -daysBack);
  const to = addStudioDays(today, daysAhead + 1);

  const rows = await prisma.booking.findMany({
    where: { status: "CONFIRMED", session: { startsAt: { gte: from, lt: to } } },
    select: { session: { select: { startsAt: true, class: { select: { name: true } } } } },
  });

  const classNames = [...new Set(rows.map((r) => r.session.class.name))].sort();
  const byDay = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const key = studioDayKey(r.session.startsAt);
    const bucket = byDay.get(key) ?? {};
    bucket[r.session.class.name] = (bucket[r.session.class.name] ?? 0) + 1;
    byDay.set(key, bucket);
  }

  const points: TrendPoint[] = [];
  for (let i = -daysBack; i <= daysAhead; i++) {
    const day = addStudioDays(today, i);
    const key = studioDayKey(day);
    const p = getZonedParts(day);
    const perClass = byDay.get(key) ?? {};
    points.push({
      dayKey: key,
      label: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][p.weekday]} ${p.day}`,
      perClass,
      total: Object.values(perClass).reduce((a, b) => a + b, 0),
    });
  }
  return { classNames, points };
}

export type SlotStat = { hour: number; label: string; bookings: number; sessions: number; fillRate: number };

/** Busiest times of day: average fill rate per start hour across all sessions. */
export async function getBusiestSlots(): Promise<SlotStat[]> {
  const sessions = await prisma.session.findMany({ select: { startsAt: true, capacity: true, bookedCount: true } });
  const byHour = new Map<number, { bookings: number; capacity: number; sessions: number }>();
  for (const s of sessions) {
    const hour = getZonedParts(s.startsAt).hour;
    const b = byHour.get(hour) ?? { bookings: 0, capacity: 0, sessions: 0 };
    b.bookings += s.bookedCount;
    b.capacity += s.capacity;
    b.sessions += 1;
    byHour.set(hour, b);
  }
  return [...byHour.entries()]
    .map(([hour, b]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      bookings: b.bookings,
      sessions: b.sessions,
      fillRate: b.capacity === 0 ? 0 : b.bookings / b.capacity,
    }))
    .sort((a, b) => a.hour - b.hour);
}
