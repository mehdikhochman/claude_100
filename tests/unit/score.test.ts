import { describe, expect, it } from "vitest";
import { computeScore } from "@/lib/score";

describe("LEGACY score", () => {
  it("awards 10 points per confirmed session", () => {
    expect(computeScore(0).points).toBe(0);
    expect(computeScore(7).points).toBe(70);
  });

  it("maps session counts to tiers", () => {
    const tierOf = (n: number) => computeScore(n).tier.name;
    expect(tierOf(0)).toBe("New here");
    expect(tierOf(1)).toBe("Warming up");
    expect(tierOf(4)).toBe("Warming up");
    expect(tierOf(5)).toBe("Finding flow");
    expect(tierOf(9)).toBe("Finding flow");
    expect(tierOf(10)).toBe("In rhythm");
    expect(tierOf(19)).toBe("In rhythm");
    expect(tierOf(20)).toBe("Devoted");
    expect(tierOf(39)).toBe("Devoted");
    expect(tierOf(40)).toBe("Legacy");
    expect(tierOf(400)).toBe("Legacy");
  });

  it("reports progress to the next tier", () => {
    const s = computeScore(7); // Finding flow: 5–9, next at 10
    expect(s.nextTier?.name).toBe("In rhythm");
    expect(s.progress).toBeCloseTo(0.4);
    expect(s.sessionsToNext).toBe(3);
    const top = computeScore(45);
    expect(top.nextTier).toBeNull();
    expect(top.progress).toBe(1);
  });
});
