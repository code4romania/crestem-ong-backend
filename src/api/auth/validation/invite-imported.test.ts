import { describe, expect, it } from "vitest";
import { inviteImportedSchema } from "./invite-imported";

describe("inviteImportedSchema", () => {
  it("rejects an empty body instead of sending to everyone", () => {
    const parsed = inviteImportedSchema.safeParse({});

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe(
      "Trimite fie emails, fie all: true",
    );
  });

  it("accepts all: true and fills in the defaults", () => {
    const parsed = inviteImportedSchema.safeParse({ all: true });

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({
      all: true,
      dryRun: false,
      batchSize: 10,
      batchDelayMs: 1000,
    });
  });

  it("rejects all: false, which is not an explicit opt-in", () => {
    expect(inviteImportedSchema.safeParse({ all: false }).success).toBe(false);
  });

  it("rejects emails and all together", () => {
    const parsed = inviteImportedSchema.safeParse({
      emails: ["contact@ong-exemplu.ro"],
      all: true,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe(
      "Trimite fie emails, fie all: true",
    );
  });

  it("rejects a misspelled field instead of ignoring it", () => {
    const parsed = inviteImportedSchema.safeParse({
      email: ["contact@ong-exemplu.ro"],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe("Câmp necunoscut: email");
  });

  it("rejects a misspelled dryRun, so a test run cannot turn into a real one", () => {
    const parsed = inviteImportedSchema.safeParse({
      emails: ["contact@ong-exemplu.ro"],
      dryrun: true,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error.issues[0].message).toBe("Câmp necunoscut: dryrun");
  });

  it("rejects a body that is not a JSON object", () => {
    expect(
      inviteImportedSchema.safeParse('{"emails":["a@b.ro"]}').success,
    ).toBe(false);
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
    expect(inviteImportedSchema.safeParse({ all: true, limit: 0 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ all: true, limit: -5 }).success).toBe(false);
  });

  it("rejects a negative or fractional afterId", () => {
    expect(inviteImportedSchema.safeParse({ all: true, afterId: -1 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ all: true, afterId: 1.5 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ all: true, afterId: 0 }).success).toBe(true);
  });

  it("rejects a batch size outside the allowed range", () => {
    expect(inviteImportedSchema.safeParse({ all: true, batchSize: 0 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ all: true, batchSize: 51 }).success).toBe(false);
    expect(inviteImportedSchema.safeParse({ all: true, batchSize: 25 }).success).toBe(true);
  });
});
