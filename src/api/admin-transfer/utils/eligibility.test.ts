import { describe, expect, it } from "vitest";
import { classifyRecipient, normalizeEmail, type Candidate } from "./eligibility";
import { TRANSFER_MESSAGES } from "./messages";

const ONG = "ong-1";
const ADMIN = "admin-1";

const account = (overrides: Partial<NonNullable<Candidate>>): Candidate => ({
  documentId: "user-1",
  email: "ana@example.ro",
  accountStatus: "active",
  role: { type: "ngo-member" },
  ong: [{ documentId: ONG }],
  ...overrides,
});

const refused = (message: string) => ({ kind: "refused", message });

describe("classifyRecipient", () => {
  it("accepts an address without an account as a new account", () => {
    expect(classifyRecipient(null, ONG, ADMIN)).toEqual({ kind: "new-account" });
  });

  it("accepts an active member of the initiating ONG", () => {
    expect(classifyRecipient(account({}), ONG, ADMIN)).toEqual({
      kind: "member",
      userDocumentId: "user-1",
    });
  });

  it("refuses a pending member of the initiating ONG with its own message", () => {
    expect(
      classifyRecipient(account({ accountStatus: "pending" }), ONG, ADMIN),
    ).toEqual(refused(TRANSFER_MESSAGES.PENDING_MEMBER));
  });

  it("refuses an existing account with no organization", () => {
    expect(
      classifyRecipient(account({ role: { type: "individual" }, ong: [] }), ONG, ADMIN),
    ).toEqual(refused(TRANSFER_MESSAGES.NOT_ELIGIBLE));
  });

  it("refuses a member of a single other ONG", () => {
    expect(
      classifyRecipient(account({ ong: [{ documentId: "ong-2" }] }), ONG, ADMIN),
    ).toEqual(refused(TRANSFER_MESSAGES.NOT_ELIGIBLE));
  });

  it("refuses a member of several ONGs, even when one is the initiating ONG", () => {
    expect(
      classifyRecipient(
        account({ ong: [{ documentId: ONG }, { documentId: "ong-2" }] }),
        ONG,
        ADMIN,
      ),
    ).toEqual(refused(TRANSFER_MESSAGES.NOT_ELIGIBLE));
  });

  it("refuses the admin of another ONG", () => {
    expect(
      classifyRecipient(
        account({ role: { type: "ngo-admin" }, ong: [{ documentId: "ong-2" }] }),
        ONG,
        ADMIN,
      ),
    ).toEqual(refused(TRANSFER_MESSAGES.NOT_ELIGIBLE));
  });

  it.each(["mentor", "editor-fdsc", "super-admin"])("refuses a %s account", (type) => {
    expect(
      classifyRecipient(account({ role: { type }, ong: [] }), ONG, ADMIN),
    ).toEqual(refused(TRANSFER_MESSAGES.NOT_ELIGIBLE));
  });

  it("refuses a deleted account", () => {
    expect(
      classifyRecipient(account({ accountStatus: "deleted", ong: [] }), ONG, ADMIN),
    ).toEqual(refused(TRANSFER_MESSAGES.NOT_ELIGIBLE));
  });

  it("refuses the initiator themselves", () => {
    expect(
      classifyRecipient(
        account({ documentId: ADMIN, role: { type: "ngo-admin" } }),
        ONG,
        ADMIN,
      ),
    ).toEqual(refused(TRANSFER_MESSAGES.SELF));
  });

  it("treats the current admin as not eligible when FDSC initiates (no initiator)", () => {
    expect(
      classifyRecipient(
        account({ documentId: ADMIN, role: { type: "ngo-admin" } }),
        ONG,
        null,
      ),
    ).toEqual(refused(TRANSFER_MESSAGES.NOT_ELIGIBLE));
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ana@Example.RO ")).toBe("ana@example.ro");
  });
});
