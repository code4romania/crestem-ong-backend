import { describe, expect, it } from "vitest";
import { accountDeletionBlock } from "./account-deletion";

describe("accountDeletionBlock", () => {
  it("blocks the contact person of an organization", () => {
    const reason = accountDeletionBlock({
      roleType: "ngo-admin",
      superAdminCount: 3,
    });
    expect(reason).toContain("persoana de contact");
  });

  it("blocks the last remaining platform administrator.", () => {
    const reason = accountDeletionBlock({
      roleType: "super-admin",
      superAdminCount: 1,
    });
    expect(reason).toContain("ultimul administrator");
  });

  it("allows a platform administrator when another one exists", () => {
    expect(
      accountDeletionBlock({ roleType: "super-admin", superAdminCount: 2 }),
    ).toBeNull();
  });

  it("allows ngo members, mentors and individuals", () => {
    expect(
      accountDeletionBlock({ roleType: "ngo-member", superAdminCount: 2 }),
    ).toBeNull();
    expect(
      accountDeletionBlock({ roleType: "mentor", superAdminCount: 2 }),
    ).toBeNull();
    expect(
      accountDeletionBlock({ roleType: "individual", superAdminCount: 2 }),
    ).toBeNull();
  });

  it("allows an account with no role at all", () => {
    expect(accountDeletionBlock({ superAdminCount: 2 })).toBeNull();
  });
});
