import { describe, expect, it } from "vitest";
import { canNgoAdminManage, isActionable, isExpired } from "./state";

const now = new Date("2026-09-24T10:00:00.000Z");
const transfer = (overrides: Record<string, unknown> = {}) => ({
  transferStatus: "pending",
  expiresAt: "2026-09-30T10:00:00.000Z",
  initiatedBy: "ngo-admin",
  initiator: { documentId: "admin-1" },
  ...overrides,
});

describe("isExpired", () => {
  it("is false before the deadline", () => {
    expect(isExpired(transfer(), now)).toBe(false);
  });

  it("is true exactly at the deadline", () => {
    expect(isExpired(transfer({ expiresAt: now.toISOString() }), now)).toBe(true);
  });

  it("is only about pending transfers", () => {
    expect(
      isExpired(transfer({ transferStatus: "accepted", expiresAt: "2020-01-01" }), now),
    ).toBe(false);
  });
});

describe("isActionable", () => {
  it("is true for a pending transfer inside its deadline", () => {
    expect(isActionable(transfer(), now)).toBe(true);
  });

  it.each(["accepted", "declined", "cancelled", "expired"])(
    "is false once %s",
    (transferStatus) => {
      expect(isActionable(transfer({ transferStatus }), now)).toBe(false);
    },
  );

  it("is false for a pending transfer past its deadline", () => {
    expect(isActionable(transfer({ expiresAt: "2026-09-01T00:00:00.000Z" }), now)).toBe(false);
  });
});

describe("canNgoAdminManage", () => {
  it("lets the ONG admin manage the transfer they started", () => {
    expect(canNgoAdminManage(transfer(), "admin-1")).toBe(true);
  });

  it("refuses a transfer FDSC started (US-5 AC1)", () => {
    expect(
      canNgoAdminManage(transfer({ initiatedBy: "fdsc", initiator: { documentId: "fdsc-1" } }), "admin-1"),
    ).toBe(false);
  });

  it("refuses a transfer another account started", () => {
    expect(canNgoAdminManage(transfer(), "admin-2")).toBe(false);
  });
});
