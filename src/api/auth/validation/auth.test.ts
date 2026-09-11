import { describe, expect, it } from "vitest";
import { registerMemberSchema } from "./auth";

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
