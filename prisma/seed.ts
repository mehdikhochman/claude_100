// Idempotent seed: runs only when the database has no users at all.
// `prisma db seed` runs it (see prisma.config.ts) — also during the Vercel build.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/lib/db";
import { getDatabaseUrl, readEnv } from "../src/lib/env";
import { addStudioDays, startOfStudioDay, zonedTimeToUtc, getZonedParts } from "../src/lib/time";

const prisma = createPrismaClient(getDatabaseUrl());

/** Shared password for all demo members (documented in the README). */
export const DEMO_MEMBER_PASSWORD = "legacy123";

const DEMO_MEMBERS = [
  { name: "Demo Member", email: "demo@legacy.studio", phone: "+225 07 00 00 00 01" },
  { name: "Awa Koné", email: "awa.kone@example.com", phone: "+225 07 11 22 33 44" },
  { name: "Yasmine Traoré", email: "yasmine.traore@example.com", phone: "+225 05 44 55 66 77" },
  { name: "Kouadio N'Guessan", email: "kouadio.nguessan@example.com", phone: "+225 01 23 45 67 89" },
  { name: "Fatou Diabaté", email: "fatou.diabate@example.com", phone: "+225 07 98 76 54 32" },
  { name: "Adjoua Kouassi", email: "adjoua.kouassi@example.com", phone: "+225 05 12 12 12 12" },
  { name: "Mariam Bamba", email: "mariam.bamba@example.com", phone: "+33 6 12 34 56 78" },
  { name: "Serge Ouattara", email: "serge.ouattara@example.com", phone: "+225 07 65 43 21 09" },
  { name: "Aïcha Cissé", email: "aicha.cisse@example.com", phone: "+225 01 88 77 66 55" },
  { name: "Jean-Marc Kouamé", email: "jeanmarc.kouame@example.com", phone: "+225 05 33 22 11 00" },
  { name: "Nadia Bakayoko", email: "nadia.bakayoko@example.com", phone: "+221 77 123 45 67" },
  { name: "Ibrahim Touré", email: "ibrahim.toure@example.com", phone: "+225 07 44 44 44 44" },
  { name: "Léa Gnamien", email: "lea.gnamien@example.com", phone: "+225 05 55 55 55 55" },
  { name: "Oumar Sangaré", email: "oumar.sangare@example.com", phone: "+225 01 66 66 66 66" },
  { name: "Chloé Adou", email: "chloe.adou@example.com", phone: "+225 07 77 77 77 77" },
];

const CLASSES = [
  {
    name: "Pilates",
    type: "Pilates",
    durationMinutes: 50,
    level: "Beginner",
    description:
      "Classical mat Pilates focused on breath, alignment and deep core control. Slow, precise, deeply restorative.",
  },
  {
    name: "Hot Mat Pilates",
    type: "Pilates",
    durationMinutes: 45,
    level: "Intermediate",
    description:
      "Mat Pilates in a warm room. Expect a steady flow, longer holds and a good sweat. Bring water and a towel.",
  },
  {
    name: "Run Club",
    type: "Run",
    durationMinutes: 60,
    level: "Beginner",
    description:
      "An easy-paced group run along the lagoon, finished with guided mobility. All paces welcome — nobody runs alone.",
  },
];

const COACHES = ["Maya", "Lina", "Adam"];
const SESSION_HOURS = [7, 10, 13];
const CAPACITY = 12;

/** Digits only of a phone number, e.g. "+225 07 00 00 00 01" -> "2250700000001". */
function digitsOf(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(`Seed skipped: database already has ${existingUsers} user(s).`);
    return;
  }

  const adminEmail = (readEnv("SEED_ADMIN_EMAIL") ?? "admin@legacy.studio").toLowerCase();
  const adminPassword = readEnv("SEED_ADMIN_PASSWORD") ?? "admin123";
  if (adminPassword.length < 6) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 6 characters.");
  }

  console.log("Seeding LEGACY…");

  // --- Users -----------------------------------------------------------------
  const admin = await prisma.user.create({
    data: {
      name: "Studio Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });

  const memberHash = await bcrypt.hash(DEMO_MEMBER_PASSWORD, 10);
  const members = [];
  for (const [index, m] of DEMO_MEMBERS.entries()) {
    members.push(
      await prisma.user.create({
        data: {
          name: m.name,
          email: m.email.toLowerCase(),
          phone: m.phone,
          phoneDigits: digitsOf(m.phone),
          passwordHash: memberHash,
          role: "MEMBER",
          // A couple of private profiles so the privacy toggle is visible in the demo.
          isPublic: index % 6 !== 5,
        },
      }),
    );
  }

  // --- Classes ---------------------------------------------------------------
  const classes = [];
  for (const c of CLASSES) {
    classes.push(await prisma.studioClass.create({ data: c }));
  }

  // --- Sessions: 7 days (tomorrow onwards) at 07:00, 10:00, 13:00 studio time --
  const today = startOfStudioDay(new Date());
  const sessions = [];
  let sessionIndex = 0;
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const day = getZonedParts(addStudioDays(today, dayOffset));
    for (const [hourIndex, hour] of SESSION_HOURS.entries()) {
      const studioClass = classes[(sessionIndex + hourIndex) % classes.length];
      const startsAt = zonedTimeToUtc({
        year: day.year,
        month: day.month,
        day: day.day,
        hour,
        minute: 0,
      });
      sessions.push({
        classId: studioClass.id,
        coachName: COACHES[sessionIndex % COACHES.length],
        startsAt,
        capacity: CAPACITY,
        index: sessionIndex,
      });
      sessionIndex++;
    }
  }

  // Booking pattern: varying fill levels, one full session (index 3 = day 2, 07:00)
  // with a waitlisted member behind it, plus a cancelled booking for the demo member.
  const FULL_SESSION_INDEX = 3;
  let bookingCount = 0;
  for (const s of sessions) {
    let confirmedMembers: typeof members;
    if (s.index === FULL_SESSION_INDEX) {
      confirmedMembers = members.slice(0, CAPACITY);
    } else {
      const fill = (s.index * 5) % 9; // 0..8 confirmed bookings
      confirmedMembers = members.slice(1, 1 + fill);
      // The demo member joins every third session so their dashboard has content.
      if (s.index % 3 === 0 && fill < CAPACITY) confirmedMembers = [members[0], ...confirmedMembers];
    }

    const session = await prisma.session.create({
      data: {
        classId: s.classId,
        coachName: s.coachName,
        startsAt: s.startsAt,
        capacity: s.capacity,
        bookedCount: confirmedMembers.length, // keeps bookedCount == CONFIRMED rows
      },
    });

    for (const [i, member] of confirmedMembers.entries()) {
      await prisma.booking.create({
        data: {
          userId: member.id,
          sessionId: session.id,
          status: "CONFIRMED",
          isPaid: (i + s.index) % 3 !== 0, // roughly two thirds have paid
        },
      });
      bookingCount++;
    }

    if (s.index === FULL_SESSION_INDEX) {
      // Two members queue for the full session — earliest first.
      for (const [i, member] of members.slice(CAPACITY, CAPACITY + 2).entries()) {
        await prisma.booking.create({
          data: {
            userId: member.id,
            sessionId: session.id,
            status: "WAITLISTED",
            waitlistedAt: new Date(Date.now() - (2 - i) * 60_000),
          },
        });
      }
    }

    if (s.index === 1) {
      // A cancelled booking so the dashboard's "Cancelled" section is not empty.
      await prisma.booking.create({
        data: { userId: members[0].id, sessionId: session.id, status: "CANCELLED" },
      });
    }
  }

  console.log(
    `Seeded 1 admin (${admin.email}), ${members.length} members, ${classes.length} classes, ` +
      `${sessions.length} sessions, ${bookingCount} confirmed bookings.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
