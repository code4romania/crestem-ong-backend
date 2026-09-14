import { describe, expect, it } from "vitest";
import { registerMemberSchema, registerMentorSchema } from "./auth";

const mentorBase = {
  nume: "Ion Popescu",
  email: "ion.popescu@example.com",
};

describe("registerMentorSchema — bio", () => {
  (globalThis as any).strapi = {
    db: { query: () => ({ findOne: async () => null }) },
  };

  it("accepts rich-text markup as long as the visible text stays within the limit", async () => {
    const bio = `<p><strong>${"a".repeat(1000)}</strong></p>`;
    const parsed = await registerMentorSchema.safeParseAsync({ ...mentorBase, bio });
    expect(parsed.success).toBe(true);
  });

  it("rejects bio whose visible text exceeds the limit, markup aside", async () => {
    const bio = `<p>${"a".repeat(1001)}</p>`;
    const parsed = await registerMentorSchema.safeParseAsync({ ...mentorBase, bio });
    expect(parsed.success).toBe(false);
  });
});

describe("registerMemberSchema", () => {
  it("accepts an email without checking whether an account already exists", async () => {
    // An NGO admin adding an existing user must not be blocked by the
    // duplicate-email check that new-account schemas use — the controller
    // looks the user up itself and attaches them instead of creating a new
    // account, so this schema must not touch the database at all.
    const parsed = await registerMemberSchema.safeParseAsync({
      nume: "Ion Popescu",
      email: "ion.popescu@ong.ro",
      rol: "Coordonator",
    });
    expect(parsed.success).toBe(true);
  });
});
