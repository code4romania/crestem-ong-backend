import { describe, expect, it } from "vitest";

import { resolveLoginTimestamps } from "./login-timestamps";

describe("resolveLoginTimestamps", () => {
  const now = new Date("2026-08-26T10:00:00.000Z");

  it("stamps both fields when the user has never logged in", () => {
    const result = resolveLoginTimestamps({ firstLoginAt: null }, now);

    expect(result.isFirstLogin).toBe(true);
    expect(result.data).toEqual({ lastLoginAt: now, firstLoginAt: now });
  });

  it("leaves firstLoginAt untouched for a returning user", () => {
    const result = resolveLoginTimestamps(
      { firstLoginAt: "2026-01-05T08:00:00.000Z" },
      now,
    );

    expect(result.isFirstLogin).toBe(false);
    expect(result.data).toEqual({ lastLoginAt: now });
  });

  it("treats a user record that could not be read as a first login", () => {
    const result = resolveLoginTimestamps(null, now);

    expect(result.isFirstLogin).toBe(true);
    expect(result.data).toEqual({ lastLoginAt: now, firstLoginAt: now });
  });
});
