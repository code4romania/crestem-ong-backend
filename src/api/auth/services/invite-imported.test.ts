import { describe, expect, it, vi } from "vitest";
import { inviteImportedAdmins } from "./invite-imported";

const USER_UID = "plugin::users-permissions.user";

const defaults = {
  dryRun: false,
  batchSize: 10,
  batchDelayMs: 0,
};

const LOGIN_LINK = "https://app.test/autentificare";

function user(id: number, email: string, ongName = "Asociația Exemplu") {
  return { id, email, nume: `Admin ${id}`, ong: [{ id: id * 10, name: ongName }] };
}

function harness(rows: any[]) {
  const findManyCalls: any[] = [];
  const strapi = {
    db: {
      query: (uid: string) => {
        expect(uid).toBe(USER_UID);
        return {
          findMany: async (params: any) => {
            findManyCalls.push(params);
            return rows;
          },
        };
      },
    },
  } as any;
  return { strapi, findManyCalls };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    buildLink: () => LOGIN_LINK,
    sendEmail: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
    ...overrides,
  } as any;
}

describe("inviteImportedAdmins", () => {
  it("selects every active ngo-admin", async () => {
    const h = harness([user(1, "a@ong.ro")]);

    await inviteImportedAdmins(h.strapi, defaults, deps());

    expect(h.findManyCalls[0].where).toEqual({
      accountStatus: "active",
      role: { type: "ngo-admin" },
    });
    expect(h.findManyCalls[0].orderBy).toEqual({ id: "asc" });
    expect(h.findManyCalls[0].populate).toEqual(["ong"]);
  });

  it("starts after the given id", async () => {
    const h = harness([user(101, "a@ong.ro")]);

    await inviteImportedAdmins(h.strapi, { ...defaults, afterId: 100 }, deps());

    expect(h.findManyCalls[0].where.id).toEqual({ $gt: 100 });
  });

  it("sends the login link and reports the id to continue from", async () => {
    const h = harness([user(7, "seven@ong.ro", "Asociația Șapte")]);
    const d = deps();

    const result = await inviteImportedAdmins(h.strapi, defaults, d);

    expect(d.sendEmail).toHaveBeenCalledWith({
      to: "seven@ong.ro",
      nume: "Admin 7",
      ongName: "Asociația Șapte",
      link: LOGIN_LINK,
    });
    expect(result).toEqual({
      total: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
      dryRun: false,
      lastId: 7,
      failures: [],
    });
  });

  it("reports no lastId when nobody is left", async () => {
    const h = harness([]);

    const result = await inviteImportedAdmins(h.strapi, defaults, deps());

    expect(result.total).toBe(0);
    expect(result.lastId).toBeNull();
  });

  it("collects delivery failures and keeps going", async () => {
    const h = harness([user(1, "ok@ong.ro"), user(2, "bad@ong.ro")]);
    const d = deps({
      sendEmail: vi.fn(async ({ to }: any) => {
        if (to === "bad@ong.ro") throw new Error("MessageRejected");
      }),
    });

    const result = await inviteImportedAdmins(h.strapi, defaults, d);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failures).toEqual([
      { email: "bad@ong.ro", error: "MessageRejected" },
    ]);
  });

  it("sends nothing on a dry run and reports who would be mailed", async () => {
    const h = harness([user(3, "three@ong.ro", "Asociația Trei")]);
    const d = deps();

    const result = await inviteImportedAdmins(
      h.strapi,
      { ...defaults, dryRun: true },
      d,
    );

    expect(d.sendEmail).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    expect(result.total).toBe(1);
    expect(result.lastId).toBe(3);
    expect(result.recipients).toEqual([
      {
        id: 3,
        email: "three@ong.ro",
        nume: "Admin 3",
        ongName: "Asociația Trei",
      },
    ]);
  });

  it("matches requested addresses case-insensitively and counts the rest as skipped", async () => {
    const h = harness([user(1, "Contact@ONG.ro"), user(2, "other@ong.ro")]);
    const d = deps();

    const result = await inviteImportedAdmins(
      h.strapi,
      { ...defaults, emails: ["contact@ong.ro", "necunoscut@ong.ro"] },
      d,
    );

    expect(result.total).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.sendEmail.mock.calls[0][0].to).toBe("Contact@ONG.ro");
  });

  it("caps the run at limit and continues from the last capped id", async () => {
    const h = harness([user(1, "a@ong.ro"), user(2, "b@ong.ro"), user(3, "c@ong.ro")]);
    const d = deps();

    const result = await inviteImportedAdmins(
      h.strapi,
      { ...defaults, limit: 2 },
      d,
    );

    expect(result.total).toBe(2);
    expect(result.lastId).toBe(2);
    expect(d.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("pauses between batches but not after the last one", async () => {
    const h = harness([user(1, "a@ong.ro"), user(2, "b@ong.ro"), user(3, "c@ong.ro")]);
    const d = deps();

    await inviteImportedAdmins(
      h.strapi,
      { ...defaults, batchSize: 1, batchDelayMs: 250 },
      d,
    );

    expect(d.sleep).toHaveBeenCalledTimes(2);
    expect(d.sleep).toHaveBeenCalledWith(250);
  });

  it("falls back to an empty organization name when the relation is missing", async () => {
    const h = harness([{ id: 9, email: "nine@ong.ro", nume: "Admin 9", ong: [] }]);
    const d = deps();

    await inviteImportedAdmins(h.strapi, defaults, d);

    expect(d.sendEmail.mock.calls[0][0].ongName).toBe("");
  });
});
