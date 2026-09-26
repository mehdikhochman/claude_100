// Fixed-window rate limiting backed by Postgres.
//
// Why the database? Vercel functions do not share memory, so an in-process
// counter would reset on every cold start and never see other instances.
// One row per key ("login:ip:1.2.3.4"), bumped with a single atomic upsert.
import { prisma } from "./db";

export type RateLimitResult = {
  ok: boolean;
  /** Attempts used in the current window (including this one). */
  count: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
};

/**
 * Count one attempt for `key` and tell the caller whether it is over the limit.
 * `limit` attempts are allowed per `windowMs`.
 */
export async function hitRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = new Date();
  const nextReset = new Date(now.getTime() + windowMs);

  // Atomic: insert a fresh window, or bump the counter / restart an expired window.
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${nextReset})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${nextReset} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  const retryAfterSeconds = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
  return { ok: row.count <= limit, count: row.count, retryAfterSeconds };
}

/** Forget a key (e.g. after a successful login, so honest users are not penalised). */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** Human message for a blocked attempt. */
export function rateLimitMessage(result: RateLimitResult): string {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Best-effort client IP behind Vercel / proxies. */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

// Limits used by the auth actions. Generous for humans, tight for scripts.
export const LIMITS = {
  loginPerIp: { limit: 20, windowMs: 15 * 60 * 1000 },
  loginPerAccount: { limit: 5, windowMs: 15 * 60 * 1000 },
  registerPerIp: { limit: 10, windowMs: 60 * 60 * 1000 },
} as const;
