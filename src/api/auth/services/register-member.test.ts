import { describe, expect, it, vi, beforeEach } from "vitest";
import { registerOrAttachMember } from "./register-member";

const membership = vi.hoisted(() => ({
  addOngMembership: vi.fn(async (): Promise<boolean> => true),
}));
vi.mock("../../../utils/membership", () => membership);

vi.mock("../utils/auth", () => ({
  ACTIVATION_PATH: "/membru/activare",
  signActivationToken: (id: number) => `token-${id}`,
  buildActivationLink: (token: string, path: string) =>
    `https://app.test${path}?token=${token}`,
  buildLoginLink: () => "https://app.test/autentificare",
}));

const USER_UID = "plugin::users-permissions.user";

function harness(existingUser: any, { failEmail = false } = {}) {
  const userQueries: any[] = [];
  const userEdits: any[] = [];
  const fail = async () => {
    if (failEmail) throw new Error("smtp down");
  };
  const emailService = {
    sendMemberAdded: vi.fn(fail),
    sendMemberActivation: vi.fn(fail),
  };
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
    service: (uid: string) => {
      expect(uid).toBe("api::email.email");
      return emailService;
    },
    plugin: () => ({
      service: () => ({
        edit: async (id: number, data: any) => {
          userEdits.push({ id, data });
        },
      }),
    }),
  };
  return { strapi, userQueries, userEdits, emailService };
}

const ong = { id: 1, documentId: "ong-1", name: "Asociația Test" };
const data = { nume: "Ion Popescu", email: "ion.popescu@ong.ro", rol: "Coordonator" };
const activeUser = {
  id: 42,
  documentId: "user-42",
  email: "Ion.Popescu@ong.ro",
  nume: "Ion Popescu",
  accountStatus: "active",
};

beforeEach(() => {
  membership.addOngMembership.mockReset();
  membership.addOngMembership.mockResolvedValue(true);
});

describe("registerOrAttachMember", () => {
  it("attaches an existing user to the ong instead of creating a new account", async () => {
    const h = harness(activeUser);
    const createMember = vi.fn();

    const result = await registerOrAttachMember(h.strapi, data, ong, createMember);

    expect(createMember).not.toHaveBeenCalled();
    expect(membership.addOngMembership).toHaveBeenCalledWith(
      h.strapi,
      "user-42",
      "ong-1",
      "Coordonator",
    );
    expect(result).toEqual({
      attached: true,
      id: 42,
      alreadyMember: false,
      emailSent: true,
    });
  });

  it("notifies an active existing user with a login link", async () => {
    const h = harness(activeUser);

    await registerOrAttachMember(h.strapi, data, ong, vi.fn());

    expect(h.emailService.sendMemberAdded).toHaveBeenCalledWith({
      to: "Ion.Popescu@ong.ro",
      nume: "Ion Popescu",
      ongName: "Asociația Test",
      link: "https://app.test/autentificare",
    });
    expect(h.emailService.sendMemberActivation).not.toHaveBeenCalled();
  });

  it("sends a fresh activation link to an existing account that is still pending", async () => {
    const h = harness({ ...activeUser, accountStatus: "pending" });

    await registerOrAttachMember(h.strapi, data, ong, vi.fn());

    expect(h.userEdits).toEqual([
      { id: 42, data: { resetPasswordToken: "token-42" } },
    ]);
    expect(h.emailService.sendMemberActivation).toHaveBeenCalledWith({
      to: "Ion.Popescu@ong.ro",
      nume: "Ion Popescu",
      ongName: "Asociația Test",
      link: "https://app.test/membru/activare?token=token-42",
    });
    expect(h.emailService.sendMemberAdded).not.toHaveBeenCalled();
  });

  it("does not email a user who is already a member of the ong", async () => {
    membership.addOngMembership.mockResolvedValue(false);
    const h = harness(activeUser);

    const result = await registerOrAttachMember(h.strapi, data, ong, vi.fn());

    expect(h.emailService.sendMemberAdded).not.toHaveBeenCalled();
    expect(result).toEqual({
      attached: true,
      id: 42,
      alreadyMember: true,
      emailSent: false,
    });
  });

  it("still attaches the user when the notification email fails", async () => {
    const h = harness(activeUser, { failEmail: true });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await registerOrAttachMember(h.strapi, data, ong, vi.fn());

    expect(membership.addOngMembership).toHaveBeenCalled();
    expect(result).toEqual({
      attached: true,
      id: 42,
      alreadyMember: false,
      emailSent: false,
    });
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
