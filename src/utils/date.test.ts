import { describe, expect, it } from "vitest";
import { bucharestDay } from "./date";

describe("bucharestDay", () => {
  it("reads a datetime as an instant, in Bucharest time", () => {
    // UTC+3 in October, UTC+2 in January.
    expect(bucharestDay("2026-10-19T22:30:00.000Z")).toBe("2026-10-20");
    expect(bucharestDay("2026-01-14T21:30:00.000Z")).toBe("2026-01-14");
    expect(bucharestDay("2026-01-14T22:30:00.000Z")).toBe("2026-01-15");
  });

  it("passes a date-only value through", () => {
    expect(bucharestDay("2026-03-01")).toBe("2026-03-01");
  });

  it("accepts a Date", () => {
    expect(bucharestDay(new Date("2026-10-19T22:30:00.000Z"))).toBe("2026-10-20");
  });

  it("returns null for nothing or garbage", () => {
    expect(bucharestDay(null)).toBeNull();
    expect(bucharestDay("")).toBeNull();
    expect(bucharestDay("not a date")).toBeNull();
  });
});
