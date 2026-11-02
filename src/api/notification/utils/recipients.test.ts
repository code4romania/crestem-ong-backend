import { describe, expect, it, vi } from "vitest";
import { ongAdminContacts } from "./recipients";

describe("ongAdminContacts", () => {
  it("filters on the user's `ong` relation and counts NULL blocked as active", async () => {
    const rows = [{ email: "a@ong.ro", nume: "Ana" }];
    const findMany = vi.fn().mockResolvedValue(rows);
    const documents = vi.fn(() => ({ findMany }));

    await expect(ongAdminContacts({ documents }, "ong-1")).resolves.toEqual(rows);

    expect(documents).toHaveBeenCalledWith("plugin::users-permissions.user");
    expect(findMany).toHaveBeenCalledWith({
      filters: {
        ong: { documentId: "ong-1" },
        role: { type: "ngo-admin" },
        accountStatus: "active",
        $or: [{ blocked: false }, { blocked: { $null: true } }],
      },
      fields: ["email", "nume"],
      limit: -1,
    });
  });
});
