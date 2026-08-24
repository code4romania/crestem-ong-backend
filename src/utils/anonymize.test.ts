import { describe, expect, it } from "vitest";
import {
  anonymousDisplayName,
  anonymousEmail,
  anonymousUsername,
  buildAnonymizedUserData,
  isAnonymized,
} from "./anonymize";

describe("anonymize helpers", () => {
  it("derives the display name from the documentId", () => {
    expect(anonymousDisplayName("abc123")).toBe("Anonim abc123");
  });

  it("derives a syntactically valid placeholder email", () => {
    expect(anonymousEmail("abc123")).toBe("deleted-abc123@anonim.local");
  });

  it("derives a username long enough for the schema minLength of 6", () => {
    expect(anonymousUsername("abc123").length).toBeGreaterThanOrEqual(6);
    expect(anonymousUsername("abc123")).toBe("deleted-abc123");
  });

  it("flags only accounts whose status is deleted", () => {
    expect(isAnonymized({ accountStatus: "deleted" })).toBe(true);
    expect(isAnonymized({ accountStatus: "active" })).toBe(false);
    expect(isAnonymized({})).toBe(false);
  });
});

describe("buildAnonymizedUserData", () => {
  const data = buildAnonymizedUserData("abc123");

  it("overwrites every identifying field", () => {
    expect(data.nume).toBe("Anonim abc123");
    expect(data.email).toBe("deleted-abc123@anonim.local");
    expect(data.username).toBe("deleted-abc123");
    expect(data.telefon).toBeNull();
    expect(data.avatar).toBeNull();
    expect(data.mentorJobTitle).toBeNull();
    expect(data.mentorOrganization).toBeNull();
  });

  it("clears every outstanding auth token", () => {
    expect(data.resetPasswordToken).toBeNull();
    expect(data.confirmationToken).toBeNull();
    expect(data.emailChangeToken).toBeNull();
  });

  it("marks the account deleted and blocked", () => {
    expect(data.accountStatus).toBe("deleted");
    expect(data.blocked).toBe(true);
  });

  it("keeps the nume above the schema minLength of 3", () => {
    expect(buildAnonymizedUserData("a").nume.length).toBeGreaterThanOrEqual(3);
  });
});
