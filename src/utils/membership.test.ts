import { describe, expect, it } from "vitest";
import { addOngMembership, cancelPendingInvite } from "./membership";

const USER_UID = "plugin::users-permissions.user";
const NGO_MEMBER_ROLE_UID = "api::ngo-member-role.ngo-member-role";

function harness(user: any, roleEntries: any[] = []) {
  const roleWrites: Array<{ op: "create" | "update" | "delete"; data: any }> = [];
  const userUpdates: Array<{ documentId: string; data: any }> = [];
  const userDeletes: Array<{ documentId: string }> = [];

  const strapi = {
    documents: (uid: string) => {
      if (uid === USER_UID) {
        return {
          findOne: async () => user,
          update: async ({ documentId, data }: any) => {
            userUpdates.push({ documentId, data });
          },
          delete: async ({ documentId }: any) => {
            userDeletes.push({ documentId });
          },
        };
      }
      if (uid === NGO_MEMBER_ROLE_UID) {
        return {
          findMany: async () => roleEntries,
          create: async ({ data }: any) => {
            roleWrites.push({ op: "create", data });
          },
          update: async ({ data }: any) => {
            roleWrites.push({ op: "update", data });
          },
          delete: async ({ documentId }: any) => {
            roleWrites.push({ op: "delete", data: { documentId } });
          },
        };
      }
      throw new Error(`unexpected uid ${uid}`);
    },
  };

  return { strapi, roleWrites, userUpdates, userDeletes };
}

const member = {
  documentId: "user-1",
  role: { type: "ngo-member" },
  ong: [],
};

describe("addOngMembership", () => {
  it("creates a ngo-member-role row when a role is given", async () => {
    const h = harness(member);
    await addOngMembership(h.strapi, "user-1", "ong-1", "Coordonator");
    expect(h.roleWrites).toEqual([
      { op: "create", data: expect.objectContaining({ role: "Coordonator" }) },
    ]);
    expect(h.userUpdates[0].data.ong).toEqual([{ documentId: "ong-1" }]);
  });

  it("attaches to the ong without creating a role row when no role is given", async () => {
    const h = harness(member);
    await addOngMembership(h.strapi, "user-1", "ong-1", undefined);
    expect(h.roleWrites).toEqual([]);
    expect(h.userUpdates).toHaveLength(1);
  });
});

describe("cancelPendingInvite", () => {
  const pendingInvite = {
    documentId: "user-2",
    accountStatus: "pending",
    role: { type: "ngo-member" },
    ong: [{ documentId: "ong-1" }],
  };

  it("deletes the account when the invite was the member's only organization", async () => {
    const h = harness(pendingInvite, [{ documentId: "role-row-1" }]);
    const result = await cancelPendingInvite(h.strapi, "user-2", "ong-1");
    expect(result).toEqual({ data: { documentId: "user-2" } });
    expect(h.roleWrites).toEqual([
      { op: "delete", data: { documentId: "role-row-1" } },
    ]);
    expect(h.userDeletes).toEqual([{ documentId: "user-2" }]);
    expect(h.userUpdates).toEqual([]);
  });

  it("keeps the pending account and only detaches the ong when another invite remains", async () => {
    const multiInvite = {
      ...pendingInvite,
      ong: [{ documentId: "ong-1" }, { documentId: "ong-2" }],
    };
    const h = harness(multiInvite);
    const result = await cancelPendingInvite(h.strapi, "user-2", "ong-1");
    expect(result).toEqual({ data: { documentId: "user-2" } });
    expect(h.userDeletes).toEqual([]);
    expect(h.userUpdates).toEqual([
      { documentId: "user-2", data: { ong: [{ documentId: "ong-2" }] } },
    ]);
  });

  it("refuses to touch an account that already activated", async () => {
    const activeUser = { ...pendingInvite, accountStatus: "active" };
    const h = harness(activeUser);
    const result = await cancelPendingInvite(h.strapi, "user-2", "ong-1");
    expect(result).toEqual({ error: "Membrul nu a fost găsit" });
    expect(h.userDeletes).toEqual([]);
    expect(h.userUpdates).toEqual([]);
  });

  it("errors when the member does not belong to that organization", async () => {
    const h = harness(pendingInvite);
    const result = await cancelPendingInvite(h.strapi, "user-2", "ong-9");
    expect(result).toEqual({ error: "Membrul nu a fost găsit" });
    expect(h.userDeletes).toEqual([]);
  });
});
