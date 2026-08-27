import crypto from "crypto";

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const parseDuration = (value: string, fallbackMs: number) => {
  const match = /^(\d+)([smhd])$/.exec((value || "").trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * DURATION_UNITS[match[2]];
};

export const hashToken = (raw: string) =>
  crypto.createHash("sha256").update(raw).digest("hex");

export const generateRawToken = () => crypto.randomBytes(48).toString("hex");

export const refreshTtlMs = () =>
  parseDuration(process.env.REFRESH_TOKEN_TTL, 30 * DURATION_UNITS.d);

/**
 * How long after a token was rotated it may still be presented without being
 * treated as reuse. Covers clients that had several requests in flight with the
 * same cookie (a Link prefetch racing the click that follows it); a genuine
 * replay lands far outside this window.
 */
export const reuseGraceMs = () =>
  parseDuration(process.env.REFRESH_REUSE_GRACE, 30 * DURATION_UNITS.s);
