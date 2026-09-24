import { describe, expect, it } from "vitest";
import {
  activateAccountSchema,
  registerMemberSchema,
  registerMentorSchema,
} from "./auth";

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

describe("activateAccountSchema — acordul termenilor", () => {
  const base = {
    token: "un-token",
    password: "ParolaNoua1!",
    confirmedPassword: "ParolaNoua1!",
  };

  it("rejects a body without the consent field", () => {
    expect(activateAccountSchema.safeParse(base).success).toBe(false);
  });

  it("rejects an unchecked box", () => {
    const parsed = activateAccountSchema.safeParse({
      ...base,
      acordTermeniSiConditii: false,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe(
      "Este necesar acordul tău pentru a continua",
    );
  });

  it("accepts a checked box", () => {
    expect(
      activateAccountSchema.safeParse({ ...base, acordTermeniSiConditii: true })
        .success,
    ).toBe(true);
  });
});
