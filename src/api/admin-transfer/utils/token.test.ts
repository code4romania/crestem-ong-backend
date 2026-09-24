import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  TRANSFER_TTL_DAYS,
  buildTransferLink,
  computeExpiresAt,
  decryptTransferToken,
  generateTransferToken,
  hashTransferToken,
} from "./token";

describe("admin transfer token", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    process.env.FRONTEND_URL = "https://crestem.test/";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("stores a hash that differs from the raw token and is deterministic", () => {
    const { raw, hash } = generateTransferToken();
    expect(hash).not.toBe(raw);
    expect(hashTransferToken(raw)).toBe(hash);
  });

  it("generates a different token every time", () => {
    expect(generateTransferToken().raw).not.toBe(generateTransferToken().raw);
  });

  it("decrypts the ciphertext back to the same raw token (resend sends the same link)", () => {
    const { raw, ciphertext } = generateTransferToken();
    expect(ciphertext).not.toContain(raw);
    expect(decryptTransferToken(ciphertext)).toBe(raw);
  });

  it("refuses a tampered ciphertext", () => {
    const { ciphertext } = generateTransferToken();
    const bytes = Buffer.from(ciphertext, "base64url");
    bytes[bytes.length - 1] ^= 0xff;
    expect(() => decryptTransferToken(bytes.toString("base64url"))).toThrow();
  });

  it("builds the link on FRONTEND_URL and encodes the token", () => {
    expect(buildTransferLink("a+b")).toBe(
      "https://crestem.test/transfer-admin?token=a%2Bb",
    );
  });

  it("expires 7 days after creation", () => {
    const now = new Date("2026-09-24T10:00:00.000Z");
    expect(TRANSFER_TTL_DAYS).toBe(7);
    expect(computeExpiresAt(now).toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });
});
