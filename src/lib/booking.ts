// ============================================================================
// The booking engine — the highest-risk file in the app.
//
// Rules (legacy, preserved exactly):
//   * A member can book a future session only, once, if spots remain.
//   * Taking a spot is ONE atomic conditional UPDATE (bookedCount < capacity).
//     Never read-then-write, so two people can't grab the last spot.
//   * Re-booking a cancelled class reuses the old booking row.
//   * Cancel only your own booking, only if the session starts >= 2 hours
//     from now (exactly 2h is allowed). Cancelling frees the spot.
//
// New in v2 (waitlist):
//   * When a session is full a member may join the waitlist (WAITLISTED row).
//   * Cancelling a CONFIRMED booking promotes the earliest waitlisted member
//     in the SAME transaction, so the spot passes hands without ever being
//     visible as free.
//
// How the concurrency story holds together (Postgres, READ COMMITTED):
//   * Every write path locks the Session row first, then touches Booking rows.
//     - book():          the conditional UPDATE itself takes the row lock.
//     - joinWaitlist():  SELECT ... FOR UPDATE on the session.
//     - cancelBooking(): SELECT ... FOR UPDATE on the session.
//     Same lock order everywhere => no deadlocks.
//   * A blocked UPDATE re-checks its WHERE clause against the newest committed
//     row once the lock is released. That is what makes "bookedCount < capacity"
//     safe under contention: the loser sees the incremented count and updates 0 rows.
//   * The unique index on (userId, sessionId) is the last line of defence
//     against one member double-booking; a violation rolls the whole
//     transaction back, including the counter increment.
//   * bookedCount is only ever changed by +1 / -1 conditional updates. The
//     invariant "bookedCount == number of CONFIRMED bookings" is asserted in tests.
// ============================================================================
import { prisma as defaultPrisma, type PrismaClient } from "./db";
import { HOUR_MS } from "./time";

/** Members may cancel until this long before the session starts. */
export const CANCEL_CUTOFF_MS = 2 * HOUR_MS;

export type BookingFailureReason =
  | "SESSION_NOT_FOUND"
  | "SESSION_PAST"
  | "SESSION_FULL"
  | "CLASS_ARCHIVED"
  | "ALREADY_BOOKED"
  | "ALREADY_WAITLISTED"
  | "BOOKING_NOT_FOUND"
  | "ALREADY_CANCELLED"
  | "TOO_LATE_TO_CANCEL";

export type BookResult =
  | { ok: true; kind: "booked"; bookingId: string }
  | { ok: true; kind: "waitlisted"; bookingId: string; position: number }
  | { ok: false; reason: BookingFailureReason; message: string };

export type CancelResult =
  | {
      ok: true;
      kind: "cancelled";
      /** Set when the freed spot went straight to a waitlisted member. */
      promoted: { userId: string; bookingId: string } | null;
    }
  | { ok: true; kind: "left_waitlist" }
  | { ok: false; reason: BookingFailureReason; message: string };

export type EngineOptions = {
  /** Prisma client to use (tests pass their own). */
  db?: PrismaClient;
  /** "Now" — injectable so tests can pin the clock. */
  now?: Date;
};

const MESSAGES: Record<BookingFailureReason, string> = {
  SESSION_NOT_FOUND: "That session no longer exists.",
  SESSION_PAST: "This session has already started.",
  SESSION_FULL: "This session is full. You can join the waitlist.",
  CLASS_ARCHIVED: "This class is no longer offered.",
  ALREADY_BOOKED: "You already have a spot in this session.",
  ALREADY_WAITLISTED: "You are already on the waitlist for this session.",
  BOOKING_NOT_FOUND: "We couldn't find that booking.",
  ALREADY_CANCELLED: "This booking was already cancelled.",
  TOO_LATE_TO_CANCEL: "Bookings can only be cancelled up to 2 hours before the session starts.",
};

/** Thrown inside a transaction to roll it back with a known reason. */
class BookingError extends Error {
  constructor(public readonly reason: BookingFailureReason) {
    super(MESSAGES[reason]);
  }
}

function fail(reason: BookingFailureReason): { ok: false; reason: BookingFailureReason; message: string } {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/** Exactly 2h before start is still allowed (>=), 1h59m is not. */
export function isCancellable(startsAt: Date, now: Date = new Date()): boolean {
  return startsAt.getTime() - now.getTime() >= CANCEL_CUTOFF_MS;
}

/** Postgres unique-violation error from Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

const TX_OPTIONS = { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 15_000 } as const;

// ----------------------------------------------------------------------------
// Book
// ----------------------------------------------------------------------------

/**
 * Give `userId` a spot in `sessionId` if one is free.
 * Returns SESSION_FULL when there is none (the UI then offers the waitlist).
 */
export async function bookSession(userId: string, sessionId: string, options: EngineOptions = {}): Promise<BookResult> {
  const db = options.db ?? defaultPrisma;
  const now = options.now ?? new Date();

  // Cheap, lock-free pre-checks for friendly errors. The authoritative checks
  // happen again inside the transaction, under the row lock.
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: { startsAt: true, class: { select: { isArchived: true } } },
  });
  if (!session) return fail("SESSION_NOT_FOUND");
  if (session.class.isArchived) return fail("CLASS_ARCHIVED");
  if (session.startsAt <= now) return fail("SESSION_PAST");

  const existing = await db.booking.findUnique({
    where: { userId_sessionId: { userId, sessionId } },
    select: { status: true },
  });
  if (existing?.status === "CONFIRMED") return fail("ALREADY_BOOKED");

  try {
    return await db.$transaction(async (tx) => {
      // (1) THE atomic take. Locks the session row until commit/rollback.
      const taken = await tx.$executeRaw`
        UPDATE "Session"
           SET "bookedCount" = "bookedCount" + 1
         WHERE "id" = ${sessionId}
           AND "bookedCount" < "capacity"
           AND "startsAt" > ${now}
      `;

      if (taken === 0) {
        // Nothing changed. Work out why, for the message.
        const fresh = await tx.session.findUnique({
          where: { id: sessionId },
          select: { startsAt: true, capacity: true, bookedCount: true },
        });
        if (!fresh) throw new BookingError("SESSION_NOT_FOUND");
        if (fresh.startsAt <= now) throw new BookingError("SESSION_PAST");
        const mine = await tx.booking.findUnique({
          where: { userId_sessionId: { userId, sessionId } },
          select: { status: true },
        });
        if (mine?.status === "CONFIRMED") throw new BookingError("ALREADY_BOOKED");
        throw new BookingError("SESSION_FULL");
      }

      // (2) We hold the spot. Attach it to this member's booking row.
      const current = await tx.booking.findUnique({
        where: { userId_sessionId: { userId, sessionId } },
      });

      if (current?.status === "CONFIRMED") {
        // A concurrent request from the same member won the race. Roll back
        // (this undoes the increment above).
        throw new BookingError("ALREADY_BOOKED");
      }

      let bookingId: string;
      if (current) {
        // Re-booking a cancelled (or waitlisted) member: reuse the row.
        const updated = await tx.booking.update({
          where: { id: current.id },
          data: { status: "CONFIRMED", waitlistedAt: null, promotedAt: null, promotionSeenAt: null },
          select: { id: true },
        });
        bookingId = updated.id;
      } else {
        // First time: create. A unique violation here means the same member
        // double-clicked; the whole transaction rolls back.
        const created = await tx.booking.create({
          data: { userId, sessionId, status: "CONFIRMED" },
          select: { id: true },
        });
        bookingId = created.id;
      }

      return { ok: true, kind: "booked", bookingId } satisfies BookResult;
    }, TX_OPTIONS);
  } catch (error) {
    if (error instanceof BookingError) return fail(error.reason);
    if (isUniqueViolation(error)) return fail("ALREADY_BOOKED");
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Waitlist
// ----------------------------------------------------------------------------

/**
 * Queue `userId` for a full session. If a spot is actually free by the time we
 * hold the lock (someone just cancelled), the member is booked directly instead.
 */
export async function joinWaitlist(userId: string, sessionId: string, options: EngineOptions = {}): Promise<BookResult> {
  const db = options.db ?? defaultPrisma;
  const now = options.now ?? new Date();

  try {
    return await db.$transaction(async (tx) => {
      // Lock the session so cancel/promote cannot interleave with us.
      const rows = await tx.$queryRaw<
        { id: string; startsAt: Date; capacity: number; bookedCount: number; isArchived: boolean }[]
      >`
        SELECT s."id", s."startsAt", s."capacity", s."bookedCount", c."isArchived"
          FROM "Session" s
          JOIN "StudioClass" c ON c."id" = s."classId"
         WHERE s."id" = ${sessionId}
         FOR UPDATE OF s
      `;
      const session = rows[0];
      if (!session) throw new BookingError("SESSION_NOT_FOUND");
      if (session.isArchived) throw new BookingError("CLASS_ARCHIVED");
      if (session.startsAt <= now) throw new BookingError("SESSION_PAST");

      const current = await tx.booking.findUnique({ where: { userId_sessionId: { userId, sessionId } } });
      if (current?.status === "CONFIRMED") throw new BookingError("ALREADY_BOOKED");
      if (current?.status === "WAITLISTED") throw new BookingError("ALREADY_WAITLISTED");

      if (session.bookedCount < session.capacity) {
        // A spot is free after all — take it (still a conditional UPDATE).
        const taken = await tx.$executeRaw`
          UPDATE "Session" SET "bookedCount" = "bookedCount" + 1
           WHERE "id" = ${sessionId} AND "bookedCount" < "capacity"
        `;
        if (taken === 0) throw new BookingError("SESSION_FULL"); // cannot happen under the lock, kept for safety
        const booking = current
          ? await tx.booking.update({
              where: { id: current.id },
              data: { status: "CONFIRMED", waitlistedAt: null, promotedAt: null, promotionSeenAt: null },
              select: { id: true },
            })
          : await tx.booking.create({ data: { userId, sessionId, status: "CONFIRMED" }, select: { id: true } });
        return { ok: true, kind: "booked", bookingId: booking.id } satisfies BookResult;
      }

      // Genuinely full: queue up.
      const booking = current
        ? await tx.booking.update({
            where: { id: current.id },
            data: { status: "WAITLISTED", waitlistedAt: now, promotedAt: null, promotionSeenAt: null },
            select: { id: true },
          })
        : await tx.booking.create({
            data: { userId, sessionId, status: "WAITLISTED", waitlistedAt: now },
            select: { id: true },
          });

      const position = await tx.booking.count({
        where: { sessionId, status: "WAITLISTED", waitlistedAt: { lte: now } },
      });

      return { ok: true, kind: "waitlisted", bookingId: booking.id, position } satisfies BookResult;
    }, TX_OPTIONS);
  } catch (error) {
    if (error instanceof BookingError) return fail(error.reason);
    if (isUniqueViolation(error)) return fail("ALREADY_WAITLISTED");
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Cancel (and auto-promote)
// ----------------------------------------------------------------------------

/**
 * Cancel the member's own booking.
 *   CONFIRMED  -> allowed until 2h before start; frees the spot or hands it to
 *                 the earliest waitlisted member in the same transaction.
 *   WAITLISTED -> leaving the queue is allowed any time before the session starts.
 */
export async function cancelBooking(userId: string, bookingId: string, options: EngineOptions = {}): Promise<CancelResult> {
  const db = options.db ?? defaultPrisma;
  const now = options.now ?? new Date();

  try {
    return await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, userId: true, sessionId: true, status: true },
      });
      // Someone else's booking is treated as "not found" — never confirm it exists.
      if (!booking || booking.userId !== userId) throw new BookingError("BOOKING_NOT_FOUND");
      if (booking.status === "CANCELLED") throw new BookingError("ALREADY_CANCELLED");

      // Lock the session row (same order as the other paths), then re-read the
      // booking: its status may have changed while we waited (e.g. promoted).
      const sessions = await tx.$queryRaw<{ id: string; startsAt: Date }[]>`
        SELECT "id", "startsAt" FROM "Session" WHERE "id" = ${booking.sessionId} FOR UPDATE
      `;
      const session = sessions[0];
      if (!session) throw new BookingError("SESSION_NOT_FOUND");

      const fresh = await tx.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: { status: true },
      });

      if (fresh.status === "CANCELLED") throw new BookingError("ALREADY_CANCELLED");

      if (fresh.status === "WAITLISTED") {
        if (session.startsAt <= now) throw new BookingError("SESSION_PAST");
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: "CANCELLED", waitlistedAt: null },
        });
        return { ok: true, kind: "left_waitlist" } satisfies CancelResult;
      }

      // CONFIRMED
      if (!isCancellable(session.startsAt, now)) throw new BookingError("TOO_LATE_TO_CANCEL");

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED", promotedAt: null, promotionSeenAt: null },
      });

      // Hand the spot to the earliest waitlisted member, if any.
      const next = await tx.booking.findFirst({
        where: { sessionId: booking.sessionId, status: "WAITLISTED" },
        orderBy: [{ waitlistedAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, userId: true },
      });

      if (next) {
        await tx.booking.update({
          where: { id: next.id },
          data: { status: "CONFIRMED", promotedAt: now, waitlistedAt: null, promotionSeenAt: null },
        });
        // bookedCount is unchanged: one out, one in.
        return {
          ok: true,
          kind: "cancelled",
          promoted: { userId: next.userId, bookingId: next.id },
        } satisfies CancelResult;
      }

      // Nobody waiting: free the spot.
      await tx.$executeRaw`
        UPDATE "Session" SET "bookedCount" = "bookedCount" - 1
         WHERE "id" = ${booking.sessionId} AND "bookedCount" > 0
      `;
      return { ok: true, kind: "cancelled", promoted: null } satisfies CancelResult;
    }, TX_OPTIONS);
  } catch (error) {
    if (error instanceof BookingError) return fail(error.reason);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Admin helper: fill newly added capacity from the waitlist
// ----------------------------------------------------------------------------

/**
 * After an admin raises a session's capacity, promote waitlisted members
 * (earliest first) until the session is full or the waitlist is empty.
 * Returns the promoted members.
 */
export async function promoteWaitlistToCapacity(
  sessionId: string,
  options: EngineOptions = {},
): Promise<{ userId: string; bookingId: string }[]> {
  const db = options.db ?? defaultPrisma;
  const now = options.now ?? new Date();

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ startsAt: Date; capacity: number; bookedCount: number }[]>`
      SELECT "startsAt", "capacity", "bookedCount" FROM "Session" WHERE "id" = ${sessionId} FOR UPDATE
    `;
    const session = rows[0];
    if (!session || session.startsAt <= now) return [];

    const free = session.capacity - session.bookedCount;
    if (free <= 0) return [];

    const waiting = await tx.booking.findMany({
      where: { sessionId, status: "WAITLISTED" },
      orderBy: [{ waitlistedAt: "asc" }, { createdAt: "asc" }],
      take: free,
      select: { id: true, userId: true },
    });
    if (waiting.length === 0) return [];

    await tx.booking.updateMany({
      where: { id: { in: waiting.map((w) => w.id) } },
      data: { status: "CONFIRMED", promotedAt: now, waitlistedAt: null, promotionSeenAt: null },
    });
    await tx.$executeRaw`
      UPDATE "Session" SET "bookedCount" = "bookedCount" + ${waiting.length}
       WHERE "id" = ${sessionId} AND "bookedCount" + ${waiting.length} <= "capacity"
    `;

    return waiting.map((w) => ({ userId: w.userId, bookingId: w.id }));
  }, TX_OPTIONS);
}

// ----------------------------------------------------------------------------
// Read helpers used by pages
// ----------------------------------------------------------------------------

/** 1-based position of a waitlisted booking, or null when not waitlisted. */
export async function waitlistPosition(bookingId: string, options: EngineOptions = {}): Promise<number | null> {
  const db = options.db ?? defaultPrisma;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { sessionId: true, status: true, waitlistedAt: true, createdAt: true },
  });
  if (!booking || booking.status !== "WAITLISTED") return null;
  const ahead = await db.booking.count({
    where: {
      sessionId: booking.sessionId,
      status: "WAITLISTED",
      waitlistedAt: { lt: booking.waitlistedAt ?? booking.createdAt },
    },
  });
  return ahead + 1;
}

/** Mark the "You're in!" banner as seen so it stops showing. */
export async function markPromotionSeen(userId: string, bookingId: string, options: EngineOptions = {}): Promise<void> {
  const db = options.db ?? defaultPrisma;
  await db.booking.updateMany({
    where: { id: bookingId, userId, promotedAt: { not: null }, promotionSeenAt: null },
    data: { promotionSeenAt: options.now ?? new Date() },
  });
}
