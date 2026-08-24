import { describe, expect, it } from "vitest";
import { deleteAccountSchema, DELETE_CONFIRMATION_WORD } from "./delete-account";

describe("deleteAccountSchema", () => {
  it("accepts the exact confirmation word", () => {
    const parsed = deleteAccountSchema.safeParse({
      currentPassword: "Secret123!",
      confirmare: DELETE_CONFIRMATION_WORD,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a different word", () => {
    const parsed = deleteAccountSchema.safeParse({
      currentPassword: "Secret123!",
      confirmare: "sterge",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const parsed = deleteAccountSchema.safeParse({ confirmare: DELETE_CONFIRMATION_WORD });
    expect(parsed.success).toBe(false);
  });
});
