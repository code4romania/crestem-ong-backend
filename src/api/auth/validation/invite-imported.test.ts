import { describe, expect, it } from "vitest";
import { inviteImportedSchema } from "./invite-imported";

describe("inviteImportedSchema", () => {
  it("accepts an empty body and fills in the defaults", () => {
    const parsed = inviteImportedSchema.safeParse({});

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      dryRun: false,
      force: false,
      batchSize: 10,
      batchDelayMs: 1000,
    });
  });

  it("normalizes addresses to lowercase instead of rejecting them", () => {
    const parsed = inviteImportedSchema.safeParse({
      emails: ["Contact@ONG-Exemplu.ro"],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data.emails).toEqual(["contact@ong-exemplu.ro"]);
  });

  it("rejects an empty array rather than treating it as 'send to everyone'", () => {
    const parsed = inviteImportedSchema.safeParse({ emails: [] });

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe(
      "Lista de emailuri nu poate fi goală",
    );
  });

  it("rejects an empty string inside the array", () => {
    const parsed = inviteImportedSchema.safeParse({ emails: [""] });

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe("Adresă de email invalidă");
  });

  it("rejects a bare string in place of the array, in Romanian", () => {
    const parsed = inviteImportedSchema.safeParse({ emails: "" });

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe(
      "Câmpul emails trebuie să fie o listă de adrese",
    );
  });

  it("rejects a non-positive limit", () => {
    expect(inviteImportedSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ limit: -5 }).success).toBe(false);
  });

  it("rejects a batch size outside the allowed range", () => {
    expect(inviteImportedSchema.safeParse({ batchSize: 0 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ batchSize: 51 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ batchSize: 25 }).success).toBe(true);
  });
});
