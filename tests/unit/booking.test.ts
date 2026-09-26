// Tests for the booking engine. These run against a real Postgres database
// (TEST_DATABASE_URL) because the whole point is real transactional behaviour.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  bookSession,
  cancelBooking,
  isCancellable,
  joinWaitlist,
  promoteWaitlistToCapacity,
  waitlistPosition,
} from "@/lib/booking";
import { HOUR_MS } from "@/lib/time";

const NOW = new Date("2026-07-03T05:00:00.000Z");
const IN_ONE_DAY = new Date(NOW.getTime() + 24 * HOUR_MS);

let classId: string;

async function makeUsers(n: number, prefix = "u"): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const u = await prisma.user.create({
      data: {
        name: `${prefix} ${i}`,
        email: `${prefix}${i}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
        passwordHash: "x",
      },
      select: { id: true },
    });
    ids.push(u.id);
  }
  return ids;
}

async function makeSession(capacity: number, startsAt = IN_ONE_DAY, bookedCount = 0): Promise<string> {
  const s = await prisma.session.create({
    data: { classId, coachName: "Maya", startsAt, capacity, bookedCount },
    select: { id: true },
  });
  return s.id;
}

/** The invariant everything hangs on. */
async function expectCounterMatchesRows(sessionId: string) {
  const [session, confirmed] = await Promise.all([
    prisma.session.findUniqueOrThrow({ where: { id: sessionId } }),
    prisma.booking.count({ where: { sessionId, status: "CONFIRMED" } }),
  ]);
  expect(session.bookedCount).toBe(confirmed);
  expect(session.bookedCount).toBeLessThanOrEqual(session.capacity);
  return session;
}

beforeAll(async () => {
  // Fresh slate in the test database.
  await prisma.booking.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.studioClass.deleteMany({});
  await prisma.user.deleteMany({});
  const c = await prisma.studioClass.create({
    data: { name: "Pilates", type: "Pilates", durationMinutes: 50, level: "Beginner", description: "test" },
  });
  classId = c.id;
});

beforeEach(async () => {
  await prisma.booking.deleteMany({});
  await prisma.session.deleteMany({});
});

describe("isCancellable (2 hour rule)", () => {
  it("allows exactly 2h before, refuses 1h59m", () => {
    const start = new Date(NOW.getTime() + 2 * HOUR_MS);
    expect(isCancellable(start, NOW)).toBe(true);
    expect(isCancellable(new Date(start.getTime() - 60_000), NOW)).toBe(false);
  });
});

describe("bookSession", () => {
  it("THE test: two concurrent attempts on a session with 1 spot left — exactly one wins", async () => {
    const [a, b] = await makeUsers(2);
    // capacity 12 with 11 already taken = exactly one spot left.
    const others = await makeUsers(11, "filler");
    const sessionId = await makeSession(12, IN_ONE_DAY, 11);
    await prisma.booking.createMany({
      data: others.map((userId) => ({ userId, sessionId, status: "CONFIRMED" as const })),
    });

    const results = await Promise.all([
      bookSession(a, sessionId, { now: NOW }),
      bookSession(b, sessionId, { now: NOW }),
    ]);

    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toMatchObject({ ok: false, reason: "SESSION_FULL" });

    const session = await expectCounterMatchesRows(sessionId);
    expect(session.bookedCount).toBe(12);
  });

  it("stress: 25 members race for 3 spots — exactly 3 succeed, counter stays exact", async () => {
    const users = await makeUsers(25, "race");
    const sessionId = await makeSession(3);

    const results = await Promise.all(users.map((u) => bookSession(u, sessionId, { now: NOW })));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok && r.reason === "SESSION_FULL")).toHaveLength(22);

    const session = await expectCounterMatchesRows(sessionId);
    expect(session.bookedCount).toBe(3);
  });

  it("the same member double-clicking gets one booking, not two", async () => {
    const [a] = await makeUsers(1);
    const sessionId = await makeSession(5);

    const results = await Promise.all([
      bookSession(a, sessionId, { now: NOW }),
      bookSession(a, sessionId, { now: NOW }),
      bookSession(a, sessionId, { now: NOW }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "ALREADY_BOOKED")).toHaveLength(2);

    const session = await expectCounterMatchesRows(sessionId);
    expect(session.bookedCount).toBe(1);
    expect(await prisma.booking.count({ where: { userId: a, sessionId } })).toBe(1);
  });

  it("refuses past sessions and archived classes", async () => {
    const [a] = await makeUsers(1);
    const past = await makeSession(5, new Date(NOW.getTime() - 60_000));
    expect(await bookSession(a, past, { now: NOW })).toMatchObject({ ok: false, reason: "SESSION_PAST" });

    const archived = await prisma.studioClass.create({
      data: { name: "Old", type: "x", durationMinutes: 1, level: "x", description: "x", isArchived: true },
    });
    const s = await prisma.session.create({
      data: { classId: archived.id, coachName: "x", startsAt: IN_ONE_DAY, capacity: 5 },
    });
    expect(await bookSession(a, s.id, { now: NOW })).toMatchObject({ ok: false, reason: "CLASS_ARCHIVED" });
    expect(await bookSession(a, "nope", { now: NOW })).toMatchObject({ ok: false, reason: "SESSION_NOT_FOUND" });
  });

  it("re-booking after a cancellation reuses the same booking row", async () => {
    const [a] = await makeUsers(1);
    const sessionId = await makeSession(5);

    const first = await bookSession(a, sessionId, { now: NOW });
    expect(first.ok).toBe(true);
    const bookingId = first.ok ? first.bookingId : "";

    const cancel = await cancelBooking(a, bookingId, { now: NOW });
    expect(cancel).toMatchObject({ ok: true, kind: "cancelled", promoted: null });
    expect((await expectCounterMatchesRows(sessionId)).bookedCount).toBe(0);

    const again = await bookSession(a, sessionId, { now: NOW });
    expect(again).toMatchObject({ ok: true, kind: "booked", bookingId });
    expect(await prisma.booking.count({ where: { userId: a, sessionId } })).toBe(1);
    expect((await expectCounterMatchesRows(sessionId)).bookedCount).toBe(1);
  });
});

describe("cancelBooking", () => {
  it("only the owner can cancel, and only once", async () => {
    const [a, b] = await makeUsers(2);
    const sessionId = await makeSession(5);
    const booked = await bookSession(a, sessionId, { now: NOW });
    const bookingId = booked.ok ? booked.bookingId : "";

    expect(await cancelBooking(b, bookingId, { now: NOW })).toMatchObject({ ok: false, reason: "BOOKING_NOT_FOUND" });
    expect(await cancelBooking(a, bookingId, { now: NOW })).toMatchObject({ ok: true });
    expect(await cancelBooking(a, bookingId, { now: NOW })).toMatchObject({ ok: false, reason: "ALREADY_CANCELLED" });
  });

  it("enforces the 2 hour cut-off (exactly 2h allowed)", async () => {
    const [a] = await makeUsers(1);
    const startsAt = new Date(NOW.getTime() + 2 * HOUR_MS);
    const sessionId = await makeSession(5, startsAt);
    const booked = await bookSession(a, sessionId, { now: NOW });
    const bookingId = booked.ok ? booked.bookingId : "";

    const tooLate = new Date(NOW.getTime() + 1);
    expect(await cancelBooking(a, bookingId, { now: tooLate })).toMatchObject({ ok: false, reason: "TOO_LATE_TO_CANCEL" });
    expect(await cancelBooking(a, bookingId, { now: NOW })).toMatchObject({ ok: true, kind: "cancelled" });
  });
});

describe("waitlist", () => {
  it("offers the waitlist when full and promotes the earliest member on cancel, atomically", async () => {
    const [a, b, c] = await makeUsers(3);
    const sessionId = await makeSession(1);

    const booked = await bookSession(a, sessionId, { now: NOW });
    expect(booked.ok).toBe(true);
    const aBooking = booked.ok ? booked.bookingId : "";

    expect(await bookSession(b, sessionId, { now: NOW })).toMatchObject({ ok: false, reason: "SESSION_FULL" });

    const wb = await joinWaitlist(b, sessionId, { now: NOW });
    const wc = await joinWaitlist(c, sessionId, { now: new Date(NOW.getTime() + 1000) });
    expect(wb).toMatchObject({ ok: true, kind: "waitlisted", position: 1 });
    expect(wc).toMatchObject({ ok: true, kind: "waitlisted", position: 2 });
    expect(await joinWaitlist(b, sessionId, { now: NOW })).toMatchObject({ ok: false, reason: "ALREADY_WAITLISTED" });
    expect(await waitlistPosition(wc.ok ? wc.bookingId : "")).toBe(2);

    // A cancels: B (earliest) is promoted in the same transaction. Counter unchanged.
    const cancel = await cancelBooking(a, aBooking, { now: NOW });
    expect(cancel).toMatchObject({ ok: true, kind: "cancelled", promoted: { userId: b } });

    const session = await expectCounterMatchesRows(sessionId);
    expect(session.bookedCount).toBe(1);

    const bRow = await prisma.booking.findUniqueOrThrow({ where: { userId_sessionId: { userId: b, sessionId } } });
    expect(bRow.status).toBe("CONFIRMED");
    expect(bRow.promotedAt).not.toBeNull();
    expect(bRow.promotionSeenAt).toBeNull();
    expect(await waitlistPosition(wc.ok ? wc.bookingId : "")).toBe(1);
  });

  it("books directly when a spot opened between seeing 'Full' and clicking 'Join waitlist'", async () => {
    const [a, b] = await makeUsers(2);
    const sessionId = await makeSession(1);
    const booked = await bookSession(a, sessionId, { now: NOW });
    await cancelBooking(a, booked.ok ? booked.bookingId : "", { now: NOW });

    const result = await joinWaitlist(b, sessionId, { now: NOW });
    expect(result).toMatchObject({ ok: true, kind: "booked" });
    expect((await expectCounterMatchesRows(sessionId)).bookedCount).toBe(1);
  });

  it("race: cancel vs join-waitlist on a full session never strands a member", async () => {
    // Whatever the interleaving, B must end up CONFIRMED and the counter exact.
    for (let round = 0; round < 5; round++) {
      await prisma.booking.deleteMany({});
      await prisma.session.deleteMany({});
      const [a, b] = await makeUsers(2, `r${round}`);
      const sessionId = await makeSession(1);
      const booked = await bookSession(a, sessionId, { now: NOW });
      const aBooking = booked.ok ? booked.bookingId : "";

      const [cancel, join] = await Promise.all([
        cancelBooking(a, aBooking, { now: NOW }),
        joinWaitlist(b, sessionId, { now: NOW }),
      ]);
      expect(cancel.ok).toBe(true);
      expect(join.ok).toBe(true);

      const bRow = await prisma.booking.findUniqueOrThrow({ where: { userId_sessionId: { userId: b, sessionId } } });
      expect(bRow.status).toBe("CONFIRMED");
      expect((await expectCounterMatchesRows(sessionId)).bookedCount).toBe(1);
    }
  });

  it("leaving the waitlist does not touch the counter", async () => {
    const [a, b] = await makeUsers(2);
    const sessionId = await makeSession(1);
    await bookSession(a, sessionId, { now: NOW });
    const w = await joinWaitlist(b, sessionId, { now: NOW });
    const left = await cancelBooking(b, w.ok ? w.bookingId : "", { now: NOW });
    expect(left).toMatchObject({ ok: true, kind: "left_waitlist" });
    expect((await expectCounterMatchesRows(sessionId)).bookedCount).toBe(1);
  });

  it("fills newly added capacity from the waitlist, earliest first", async () => {
    const [a, b, c, d] = await makeUsers(4);
    const sessionId = await makeSession(1);
    await bookSession(a, sessionId, { now: NOW });
    await joinWaitlist(b, sessionId, { now: NOW });
    await joinWaitlist(c, sessionId, { now: new Date(NOW.getTime() + 1000) });
    await joinWaitlist(d, sessionId, { now: new Date(NOW.getTime() + 2000) });

    await prisma.session.update({ where: { id: sessionId }, data: { capacity: 3 } });
    const promoted = await promoteWaitlistToCapacity(sessionId, { now: NOW });
    expect(promoted.map((p) => p.userId)).toEqual([b, c]);

    const session = await expectCounterMatchesRows(sessionId);
    expect(session.bookedCount).toBe(3);
    const dRow = await prisma.booking.findUniqueOrThrow({ where: { userId_sessionId: { userId: d, sessionId } } });
    expect(dRow.status).toBe("WAITLISTED");
  });
});

describe("negative control — why the atomic UPDATE matters", () => {
  it("a naive read-then-write DOES double-book under the same race", async () => {
    // This is the bug the engine prevents. Never copy this pattern into app code.
    const naiveBook = async (userId: string, sessionId: string) => {
      const s = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
      if (s.bookedCount >= s.capacity) return false;
      await new Promise((r) => setTimeout(r, 30)); // widen the window, like real network latency
      await prisma.session.update({ where: { id: sessionId }, data: { bookedCount: s.bookedCount + 1 } });
      await prisma.booking.create({ data: { userId, sessionId, status: "CONFIRMED" } });
      return true;
    };

    const users = await makeUsers(6, "naive");
    const sessionId = await makeSession(1);
    const results = await Promise.all(users.map((u) => naiveBook(u, sessionId)));
    const confirmed = await prisma.booking.count({ where: { sessionId, status: "CONFIRMED" } });

    expect(results.filter(Boolean).length).toBeGreaterThan(1); // over-booked
    expect(confirmed).toBeGreaterThan(1); // more people than spots
  });
});
