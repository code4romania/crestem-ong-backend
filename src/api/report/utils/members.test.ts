import { describe, expect, it } from "vitest";
import { memberView, resolveMembers } from "./members";

describe("memberView", () => {
  it("returns the real name and email for an active account", () => {
    expect(
      memberView({
        documentId: "u1",
        nume: "Ana Pop",
        email: "ana@example.com",
        accountStatus: "active",
      }),
    ).toEqual({ documentId: "u1", nume: "Ana Pop", email: "ana@example.com" });
  });

  it("hides the placeholder email of a deleted account", () => {
    expect(
      memberView({
        documentId: "u2",
        nume: "Anonim u2",
        email: "deleted-u2@anonim.local",
        accountStatus: "deleted",
      }),
    ).toEqual({ documentId: "u2", nume: "Anonim u2", email: null });
  });
});

const mockStrapi = (users: any[]) => ({
  documents: () => ({ findMany: async () => users }),
});

describe("resolveMembers", () => {
  it("reports a deleted account with the specific message, not the membership one", async () => {
    // Deletion clears `ong` and demotes the role, so this account also fails the
    // membership check — the deleted-account branch has to be reached first.
    const strapi = mockStrapi([
      {
        documentId: "u2",
        nume: "Anonim u2",
        email: "deleted-u2@anonim.local",
        accountStatus: "deleted",
        ong: [],
        role: { type: "individual" },
      },
    ]);

    const result = await resolveMembers(strapi, "ong-1", ["u2"]);

    expect(result).toEqual({
      error: "Utilizatorul Anonim u2 și-a șters contul și nu mai poate fi invitat",
    });
  });

  it("still reports a live non-member with the membership message", async () => {
    const strapi = mockStrapi([
      {
        documentId: "u3",
        nume: "Ana Pop",
        email: "ana@example.com",
        accountStatus: "active",
        ong: [],
        role: { type: "individual" },
      },
    ]);

    const result = await resolveMembers(strapi, "ong-1", ["u3"]);

    expect(result).toEqual({
      error: "Utilizatorul ana@example.com nu este membru al organizației",
    });
  });
});
