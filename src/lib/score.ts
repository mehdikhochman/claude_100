// The LEGACY score: 10 points per confirmed session, with tiers.
// Tier boundaries are counted in sessions (0 · 1–4 · 5–9 · 10–19 · 20–39 · 40+).
import { prisma as defaultPrisma, type PrismaClient } from "./db";

export const POINTS_PER_SESSION = 10;

export type Tier = { name: string; minSessions: number };

export const TIERS: Tier[] = [
  { name: "New here", minSessions: 0 },
  { name: "Warming up", minSessions: 1 },
  { name: "Finding flow", minSessions: 5 },
  { name: "In rhythm", minSessions: 10 },
  { name: "Devoted", minSessions: 20 },
  { name: "Legacy", minSessions: 40 },
];

export type LegacyScore = {
  sessions: number;
  points: number;
  tier: Tier;
  /** null once the member has reached the top tier. */
  nextTier: Tier | null;
  /** 0..1 progress from the current tier to the next. 1 at the top tier. */
  progress: number;
  sessionsToNext: number;
};

/** Pure: turn a confirmed-session count into a score with tier info. */
export function computeScore(sessions: number): LegacyScore {
  const safe = Math.max(0, Math.floor(sessions));
  let tierIndex = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (safe >= TIERS[i].minSessions) tierIndex = i;
  }
  const tier = TIERS[tierIndex];
  const nextTier = TIERS[tierIndex + 1] ?? null;
  const span = nextTier ? nextTier.minSessions - tier.minSessions : 1;
  const progress = nextTier ? (safe - tier.minSessions) / span : 1;
  return {
    sessions: safe,
    points: safe * POINTS_PER_SESSION,
    tier,
    nextTier,
    progress: Math.min(1, Math.max(0, progress)),
    sessionsToNext: nextTier ? nextTier.minSessions - safe : 0,
  };
}

/** Score for one member (counts CONFIRMED bookings). */
export async function getScoreForUser(userId: string, db: PrismaClient = defaultPrisma): Promise<LegacyScore> {
  const sessions = await db.booking.count({ where: { userId, status: "CONFIRMED" } });
  return computeScore(sessions);
}

/** Scores for many members at once (one query) — used by member lists. */
export async function getScoresForUsers(
  userIds: string[],
  db: PrismaClient = defaultPrisma,
): Promise<Map<string, LegacyScore>> {
  const map = new Map<string, LegacyScore>();
  if (userIds.length === 0) return map;
  const rows = await db.booking.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, status: "CONFIRMED" },
    _count: { _all: true },
  });
  for (const id of userIds) map.set(id, computeScore(0));
  for (const row of rows) map.set(row.userId, computeScore(row._count._all));
  return map;
}
