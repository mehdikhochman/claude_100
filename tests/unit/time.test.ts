import { describe, expect, it } from "vitest";
import {
  formatSessionTime,
  parseDateTimeLocal,
  studioDayKey,
  toDateTimeLocalValue,
  zonedTimeToUtc,
} from "@/lib/time";

describe("time helpers (studio timezone = Africa/Abidjan)", () => {
  it("formats like the legacy app: 'Friday 3 Jul · 07:00'", () => {
    expect(formatSessionTime(new Date("2026-07-03T07:00:00Z"))).toBe("Friday 3 Jul · 07:00");
  });

  it("converts studio wall-clock time to UTC", () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 7, day: 3, hour: 7, minute: 0 });
    expect(utc.toISOString()).toBe("2026-07-03T07:00:00.000Z");
  });

  it("handles other zones, including daylight saving", () => {
    // Paris in July is UTC+2.
    const summer = zonedTimeToUtc({ year: 2026, month: 7, day: 3, hour: 7, minute: 0 }, "Europe/Paris");
    expect(summer.toISOString()).toBe("2026-07-03T05:00:00.000Z");
    // Paris in January is UTC+1.
    const winter = zonedTimeToUtc({ year: 2026, month: 1, day: 3, hour: 7, minute: 0 }, "Europe/Paris");
    expect(winter.toISOString()).toBe("2026-01-03T06:00:00.000Z");
  });

  it("round-trips datetime-local input values", () => {
    const date = parseDateTimeLocal("2026-07-03T13:30");
    expect(date?.toISOString()).toBe("2026-07-03T13:30:00.000Z");
    expect(toDateTimeLocalValue(date!)).toBe("2026-07-03T13:30");
    expect(parseDateTimeLocal("nonsense")).toBeNull();
    expect(parseDateTimeLocal("2026-13-03T13:30")).toBeNull();
  });

  it("groups by studio day", () => {
    expect(studioDayKey(new Date("2026-07-03T23:59:00Z"))).toBe("2026-07-03");
  });
});
