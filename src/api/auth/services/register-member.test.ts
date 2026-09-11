import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerOrAttachMember } from "./register-member";

const membership = vi.hoisted(() => ({ addOngMembership: vi.fn(async () => {}) }));
vi.mock("../../../utils/membership", () => membership);

const USER_UID = "plugin::users-permissions.user";

function harness(existingUser: any) {
  const userQueries: any[] = [];
  const strapi = {
    db: {
      query: (uid: string) => ({
        findOne: async (params: any) => {
          expect(uid).toBe(USER_UID);
          userQueries.push(params);
          return existingUser;
        },
      }),
    },
  };
  return { strapi, userQueries };
}

const ong = { id: 1, documentId: "ong-1", name: "Asociația Test" };
const data = { nume: "Ion Popescu", email: "ion.popescu@ong.ro", rol: "Coordonator" };

beforeEach(() => {
  membership.addOngMembership.mockClear();
});

describe("registerOrAttachMember", () => {
  it("attaches an existing user to the ong instead of creating a new account", async () => {
    const h = harness({ id: 42, documentId: "user-42" });
    const createMember = vi.fn();

    const result = await registerOrAttachMember(h.strapi, data, ong, createMember);

    expect(createMember).not.toHaveBeenCalled();
    expect(membership.addOngMembership).toHaveBeenCalledWith(
      h.strapi,
      "user-42",
      "ong-1",
      "Coordonator",
    );
    expect(result).toEqual({ attached: true, id: 42 });
  });

  it("looks the user up by email case-insensitively", async () => {
    const h = harness(null);
    await registerOrAttachMember(h.strapi, data, ong, vi.fn(async () => ({
      id: 1,
      emailSent: true,
    })));

    expect(h.userQueries).toEqual([
      { where: { email: { $eqi: "ion.popescu@ong.ro" } } },
    ]);
  });

  it("creates a new account when no user has that email", async () => {
    const h = harness(null);
    const createMember = vi.fn(async () => ({ id: 7, emailSent: true }));

    const result = await registerOrAttachMember(h.strapi, data, ong, createMember);

    expect(createMember).toHaveBeenCalledWith(data, ong);
    expect(membership.addOngMembership).not.toHaveBeenCalled();
    expect(result).toEqual({ attached: false, id: 7, emailSent: true });
  });
});
