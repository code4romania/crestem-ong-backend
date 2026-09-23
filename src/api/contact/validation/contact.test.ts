import { describe, expect, it } from "vitest";
import { submitContactSchema, updateContactStatusSchema } from "./contact";

const valid = {
  name: "  Ion Popescu  ",
  email: "ion@example.org",
  organization: "",
  subject: "Parteneriate",
  message: "Bună ziua, aș vrea să discutăm.",
  consent: true,
};

describe("submitContactSchema", () => {
  it("accepts a valid payload and trims the name", () => {
    const parsed = submitContactSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Ion Popescu");
  });

  it("defaults organization to an empty string", () => {
    const { organization, ...rest } = valid;
    const parsed = submitContactSchema.safeParse(rest);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.organization).toBe("");
    }
  });

  it("rejects a missing name", () => {
    expect(submitContactSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(submitContactSchema.safeParse({ ...valid, email: "ion@" }).success).toBe(false);
  });

  it("rejects an empty subject", () => {
    expect(submitContactSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
  });

  it("rejects a message under 3 chars", () => {
    expect(submitContactSchema.safeParse({ ...valid, message: "ok" }).success).toBe(false);
  });

  it("accepts a message of exactly 3 chars", () => {
    expect(submitContactSchema.safeParse({ ...valid, message: "bun" }).success).toBe(true);
  });

  it("rejects a message over 5000 chars", () => {
    expect(submitContactSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success).toBe(false);
  });

  it("rejects consent that is false", () => {
    expect(submitContactSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it("rejects consent that is missing", () => {
    const { consent, ...rest } = valid;
    expect(submitContactSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(submitContactSchema.safeParse({ ...valid, status: "closed" }).success).toBe(false);
  });

  it("rejects an unknown website key, since the controller strips the honeypot before parsing", () => {
    expect(submitContactSchema.safeParse({ ...valid, website: "http://spam.example" }).success).toBe(false);
  });
});

describe("updateContactStatusSchema", () => {
  it("accepts each of the three statuses", () => {
    for (const status of ["new", "in_progress", "closed"]) {
      expect(updateContactStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(updateContactStatusSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});
