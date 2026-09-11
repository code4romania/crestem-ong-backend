import { describe, expect, it } from "vitest";
import { addOngMembership } from "./membership";

const USER_UID = "plugin::users-permissions.user";
const NGO_MEMBER_ROLE_UID = "api::ngo-member-role.ngo-member-role";

function harness(user: any) {
  const roleWrites: Array<{ op: "create" | "update"; data: any }> = [];
  const userUpdates: Array<{ documentId: string; data: any }> = [];

  const strapi = {
    documents: (uid: string) => {
      if (uid === USER_UID) {
        return {
          findOne: async () => user,
          update: async ({ documentId, data }: any) => {
            userUpdates.push({ documentId, data });
          },
        };
      }
      if (uid === NGO_MEMBER_ROLE_UID) {
        return {
          findMany: async () => [],
          create: async ({ data }: any) => {
            roleWrites.push({ op: "create", data });
          },
          update: async ({ data }: any) => {
            roleWrites.push({ op: "update", data });
          },
        };
      }
      throw new Error(`unexpected uid ${uid}`);
    },
  };

  return { strapi, roleWrites, userUpdates };
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
