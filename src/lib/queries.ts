// Read-only queries shared by several pages. Keeping them here means the
// schedule, home page and dashboard all agree on what "upcoming" means.
import { prisma } from "./db";

export type ScheduleSession = {
  id: string;
  startsAt: Date;
  capacity: number;
  bookedCount: number;
  coachName: string;
  waitlistCount: number;
  class: { id: string; name: string; type: string; durationMinutes: number; level: string };
  /** The viewer's own booking on this session, when logged in. */
  mine: { id: string; status: "CONFIRMED" | "CANCELLED" | "WAITLISTED" } | null;
};

/** Upcoming sessions of active classes, soonest first. */
export async function getUpcomingSessions(options: {
  viewerId?: string | null;
  limit?: number;
  now?: Date;
}): Promise<ScheduleSession[]> {
  const now = options.now ?? new Date();
  const rows = await prisma.session.findMany({
    where: { startsAt: { gte: now }, class: { isArchived: false } },
    orderBy: { startsAt: "asc" },
    take: options.limit,
    select: {
      id: true,
      startsAt: true,
      capacity: true,
      bookedCount: true,
      coachName: true,
      class: { select: { id: true, name: true, type: true, durationMinutes: true, level: true } },
      _count: { select: { bookings: { where: { status: "WAITLISTED" } } } },
      bookings: options.viewerId
        ? { where: { userId: options.viewerId }, select: { id: true, status: true }, take: 1 }
        : false,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    startsAt: row.startsAt,
    capacity: row.capacity,
    bookedCount: row.bookedCount,
    coachName: row.coachName,
    waitlistCount: row._count.bookings,
    class: row.class,
    mine: Array.isArray(row.bookings) && row.bookings[0] ? row.bookings[0] : null,
  }));
}

/** Classes shown publicly (not archived). */
export async function getActiveClasses() {
  return prisma.studioClass.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: "asc" },
  });
}

export type MemberBooking = {
  id: string;
  status: "CONFIRMED" | "CANCELLED" | "WAITLISTED";
  isPaid: boolean;
  createdAt: Date;
  promotedAt: Date | null;
  promotionSeenAt: Date | null;
  session: {
    id: string;
    startsAt: Date;
    coachName: string;
    capacity: number;
    bookedCount: number;
    class: { id: string; name: string; durationMinutes: number; level: string; type: string };
  };
};

/** Everything a member has ever booked, soonest session first. */
export async function getBookingsForUser(userId: string): Promise<MemberBooking[]> {
  return prisma.booking.findMany({
    where: { userId },
    orderBy: { session: { startsAt: "asc" } },
    select: {
      id: true,
      status: true,
      isPaid: true,
      createdAt: true,
      promotedAt: true,
      promotionSeenAt: true,
      session: {
        select: {
          id: true,
          startsAt: true,
          coachName: true,
          capacity: true,
          bookedCount: true,
          class: { select: { id: true, name: true, durationMinutes: true, level: true, type: true } },
        },
      },
    },
  });
}
