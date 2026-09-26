import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { clearRateLimit, hitRateLimit } from "@/lib/rate-limit";

describe("rate limit (Postgres fixed window)", () => {
  beforeEach(async () => {
    await prisma.rateLimit.deleteMany({});
  });

  it("allows up to the limit then blocks", async () => {
    const key = "test:limit";
    for (let i = 1; i <= 3; i++) {
      const r = await hitRateLimit(key, 3, 60_000);
      expect(r.ok).toBe(true);
      expect(r.count).toBe(i);
    }
    const blocked = await hitRateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("starts a new window after the old one expires", async () => {
    const key = "test:expiry";
    // Plant an expired window by hand.
    await prisma.rateLimit.create({
      data: { key, count: 99, resetAt: new Date(Date.now() - 1000) },
    });
    const r = await hitRateLimit(key, 3, 60_000);
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
  });

  it("counts concurrent hits exactly once each", async () => {
    const key = "test:concurrent";
    const results = await Promise.all(Array.from({ length: 10 }, () => hitRateLimit(key, 100, 60_000)));
    const counts = results.map((r) => r.count).sort((a, b) => a - b);
    expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("can be cleared", async () => {
    const key = "test:clear";
    await hitRateLimit(key, 1, 60_000);
    await clearRateLimit(key);
    const r = await hitRateLimit(key, 1, 60_000);
    expect(r.ok).toBe(true);
  });
});
