import jwt from "jsonwebtoken";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  changeMentorEmail,
  deleteMentor,
  resendMentorInvitation,
} from "./mentor-admin";

const USER_UID = "plugin::users-permissions.user";

interface HarnessOptions {
  /** Account that already owns the address being switched to. */
  existingByEmail?: { id: number } | null;
  emailThrows?: boolean;
  resendThrows?: string;
  /** Rows per content type, as `count` reports them. */
  counts?: Record<string, number>;
}

function harness(user: any | null, options: HarnessOptions = {}) {
  const edits: Array<{ id: number; data: any }> = [];
  const sentEmails: any[] = [];
  const resendCalls: number[] = [];
  const userQueries: any[] = [];
  const hardDeleted: string[] = [];
  const revoked: number[] = [];
  const removedFiles: any[] = [];
  const countQueries: Array<{ uid: string; where: any }> = [];
  const events: string[] = [];
  let transactionCount = 0;

  const strapi = {
    db: {
      transaction: async (cb: () => Promise<unknown>) => {
        transactionCount += 1;
        return cb();
      },
      query: (uid: string) => ({
        count: vi.fn(async ({ where }: any) => {
          countQueries.push({ uid, where });
          return options.counts?.[uid] ?? 0;
        }),
        delete: vi.fn(async ({ where }: any) => {
          expect(uid).toBe("plugin::upload.file");
          events.push("file-row-delete");
          removedFiles.push(where.id);
        }),
        findOne: vi.fn(async (params: any) => {
          expect(uid).toBe(USER_UID);
          userQueries.push(params);
          if (params.where.documentId) return user;
          if (params.where.email) return options.existingByEmail ?? null;
          return null;
        }),
      }),
    },
    config: { get: () => ({ provider: "local" }) },
    documents: (uid: string) => ({
      delete: vi.fn(async ({ documentId }: any) => {
        expect(uid).toBe(USER_UID);
        events.push("hard-delete");
        hardDeleted.push(documentId);
      }),
    }),
    plugin: () => ({
      service: () => ({
        edit: vi.fn(async (id: number, data: any) => {
          events.push("edit");
          edits.push({ id, data });
        }),
      }),
      provider: {
        delete: vi.fn(async () => {
          events.push("provider-delete");
        }),
      },
    }),
    service: (name: string) => {
      if (name === "api::refresh-token.refresh-token") {
        return {
          revokeAllForUser: vi.fn(async (id: number) => {
            events.push("revoke");
            revoked.push(id);
          }),
        };
      }
      if (name === "api::auth.auth") {
        return {
          resendMentorInvite: vi.fn(async (id: number) => {
            resendCalls.push(id);
            if (options.resendThrows) throw new Error(options.resendThrows);
            return { emailSent: true };
          }),
        };
      }
      return {
        sendAdminEmailChangeConfirmation: vi.fn(async (args: any) => {
          if (options.emailThrows) throw new Error("smtp down");
          sentEmails.push(args);
        }),
      };
    },
  };

  return {
    strapi,
    edits,
    sentEmails,
    resendCalls,
    userQueries,
    hardDeleted,
    revoked,
    removedFiles,
    countQueries,
    events,
    transactionCount: () => transactionCount,
  };
}

const pending = {
  id: 7,
  documentId: "mentor-7",
  nume: "Ana Pop",
  email: "ana@x.ro",
  username: "ana@x.ro",
  accountStatus: "pending",
  role: { type: "mentor" },
};
const active = { ...pending, accountStatus: "active" };

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

describe("changeMentorEmail", () => {
  it("refuses a non-mentor target", async () => {
    const h = harness({ ...active, role: { type: "ngo-member" } });
    const result = await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
    expect(result).toMatchObject({ status: 400 });
    expect(h.edits).toEqual([]);
  });

  it("returns 404 for an unknown account", async () => {
    const h = harness(null);
    const result = await changeMentorEmail(h.strapi, "nope", "nou@x.ro");
    expect(result).toEqual({ error: "Utilizatorul nu a fost găsit", status: 404 });
  });

  it("loads the target with role and avatar populated", async () => {
    const h = harness(active);
    await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
    expect(h.userQueries[0].populate).toEqual(["role", "avatar"]);
  });

  it("refuses an address taken by another account, case-insensitively", async () => {
    const h = harness(active, { existingByEmail: { id: 99 } });
    const result = await changeMentorEmail(h.strapi, "mentor-7", "ANA2@x.ro");
    expect(result).toEqual({
      error: "Există deja un cont cu această adresă de email",
      status: 400,
    });
    expect(h.userQueries[1].where.email).toEqual({ $eqi: "ana2@x.ro" });
    expect(h.edits).toEqual([]);
    expect(h.sentEmails).toEqual([]);
  });

  it("refuses the address the account already has", async () => {
    const h = harness(active);
    const result = await changeMentorEmail(h.strapi, "mentor-7", "Ana@X.ro");
    expect(result).toMatchObject({ status: 400 });
    expect("error" in result).toBe(true);
    expect(h.edits).toEqual([]);
  });

  it("swaps the address of a pending account and re-sends the invitation", async () => {
    const h = harness(pending);
    const result = await changeMentorEmail(h.strapi, "mentor-7", " Nou@X.ro ");
    expect(h.edits[0].id).toBe(7);
    expect(h.edits[0].data.email).toBe("nou@x.ro");
    expect(h.resendCalls).toEqual([7]);
    expect(result).toEqual({ mode: "invite-resent", emailSent: true });
    expect(h.sentEmails).toEqual([]);
  });

  it("keeps the new address and reports emailSent false when the re-send throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness(pending, { resendThrows: "smtp down" });
    const result = await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
    expect(h.edits[0].data.email).toBe("nou@x.ro");
    expect(h.resendCalls).toEqual([7]);
    expect(result).toEqual({ mode: "invite-resent", emailSent: false });
    expect(logged).toHaveBeenCalledWith(
      "changeMentorEmail invite resend failed",
      expect.any(Error),
    );
    logged.mockRestore();
  });

  it("rewrites the username of a pending account when one is set", async () => {
    const h = harness(pending);
    await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
    expect(h.edits[0].data.username).toBe("nou@x.ro");
  });

  it("leaves the username alone when a pending account has none", async () => {
    const h = harness({ ...pending, username: null });
    await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
    expect(h.edits[0].data).toEqual({ email: "nou@x.ro" });
  });

  it("leaves an active account's address alone and mails a 7-day confirmation link to the new one", async () => {
    const h = harness(active);
    const result = await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");

    expect(h.edits).toHaveLength(1);
    expect(Object.keys(h.edits[0].data)).toEqual(["emailChangeToken"]);
    const token = h.edits[0].data.emailChangeToken;
    expect(typeof token).toBe("string");

    expect(h.sentEmails).toHaveLength(1);
    expect(h.sentEmails[0].to).toBe("nou@x.ro");
    expect(h.sentEmails[0].nume).toBe("Ana Pop");
    expect(h.sentEmails[0].link).toContain(encodeURIComponent(token));

    const payload = jwt.decode(token) as any;
    expect(payload.purpose).toBe("email-change");
    expect(payload.newEmail).toBe("nou@x.ro");
    expect(payload.id).toBe(7);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 3600);

    expect(h.resendCalls).toEqual([]);
    expect(result).toEqual({ mode: "confirmation-sent", emailSent: true });
  });

  it("never mails the old address", async () => {
    for (const user of [pending, active]) {
      const h = harness(user);
      await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
      expect(h.sentEmails.some((e) => e.to === "ana@x.ro")).toBe(false);
    }
  });

  it("keeps the token and reports emailSent false when delivery fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness(active, { emailThrows: true });
    const result = await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
    expect(typeof h.edits[0].data.emailChangeToken).toBe("string");
    expect(result).toEqual({ mode: "confirmation-sent", emailSent: false });
    logged.mockRestore();
  });

  it("refuses a deleted account", async () => {
    const h = harness({ ...pending, accountStatus: "deleted" });
    const result = await changeMentorEmail(h.strapi, "mentor-7", "nou@x.ro");
    expect(result).toEqual({ error: "Contul a fost șters.", status: 400 });
    expect(h.edits).toEqual([]);
  });
});

describe("resendMentorInvitation", () => {
  it("delegates to the auth service with the numeric id", async () => {
    const h = harness(pending);
    const result = await resendMentorInvitation(h.strapi, "mentor-7");
    expect(h.resendCalls).toEqual([7]);
    expect(result).toEqual({ emailSent: true });
  });

  it("turns 'already active' into a 400", async () => {
    const h = harness(active, { resendThrows: "Contul este deja activat" });
    const result = await resendMentorInvitation(h.strapi, "mentor-7");
    expect(result).toEqual({ error: "Contul este deja activat", status: 400 });
  });

  it("refuses a non-mentor target without calling the auth service", async () => {
    const h = harness({ ...pending, role: { type: "ngo-admin" } });
    const result = await resendMentorInvitation(h.strapi, "mentor-7");
    expect(result).toMatchObject({ status: 400 });
    expect(h.resendCalls).toEqual([]);
  });
});

describe("deleteMentor", () => {
  it("hard-deletes a pending mentor with nothing attached", async () => {
    const h = harness(pending);
    const result = await deleteMentor(h.strapi, "mentor-7");
    expect(result).toEqual({ mode: "deleted" });
    expect(h.hardDeleted).toEqual(["mentor-7"]);
    expect(h.edits).toEqual([]);
  });

  it("checks every relation that can carry mentoring history", async () => {
    const h = harness(pending);
    await deleteMentor(h.strapi, "mentor-7");
    expect(h.countQueries).toEqual([
      { uid: "api::ngo-mentor.ngo-mentor", where: { mentors: { id: 7 } } },
      { uid: "api::program.program", where: { mentors: { id: 7 } } },
      { uid: "api::conversation.conversation", where: { mentor: { id: 7 } } },
      { uid: "api::message.message", where: { sender: { id: 7 } } },
      { uid: "api::meeting.meeting", where: { mentor: { id: 7 } } },
    ]);
  });

  it("anonymizes a pending mentor that has history attached", async () => {
    const h = harness(pending, { counts: { "api::meeting.meeting": 1 } });
    const result = await deleteMentor(h.strapi, "mentor-7");
    expect(result).toEqual({ mode: "anonymized" });
    expect(h.hardDeleted).toEqual([]);
    expect(h.edits).toHaveLength(1);
  });

  it("anonymizes an active mentor without touching assignments", async () => {
    const h = harness(active, {
      counts: { "api::ngo-mentor.ngo-mentor": 2, "api::program.program": 1 },
    });
    const result = await deleteMentor(h.strapi, "mentor-7");
    expect(result).toEqual({ mode: "anonymized" });
    expect(h.hardDeleted).toEqual([]);
    expect(h.edits).toHaveLength(1);
    expect(h.edits[0].id).toBe(7);
    expect(h.edits[0].data).toMatchObject({
      nume: "Anonim mentor-7",
      email: "deleted-mentor-7@anonim.local",
      accountStatus: "deleted",
      bio: null,
      dimensiuni: [],
    });
    expect(typeof h.edits[0].data.password).toBe("string");
    expect(h.edits[0].data.password.length).toBeGreaterThanOrEqual(32);
    // Only the user row is written; ngo-mentor / program rows stay (BR-34).
    expect(h.events).toEqual(["revoke", "edit"]);
  });

  it("revokes sessions and deletes the avatar file before clearing the relation", async () => {
    const h = harness({ ...active, avatar: { id: 9, provider: "local" } });
    await deleteMentor(h.strapi, "mentor-7");
    expect(h.revoked).toEqual([7]);
    expect(h.removedFiles).toEqual([9]);
    expect(h.events).toEqual([
      "revoke",
      "provider-delete",
      "file-row-delete",
      "edit",
    ]);
  });

  it("purges the avatar of a hard-deleted mentor too", async () => {
    const h = harness({ ...pending, avatar: { id: 9, provider: "local" } });
    await deleteMentor(h.strapi, "mentor-7");
    expect(h.removedFiles).toEqual([9]);
    expect(h.events.at(-1)).toBe("hard-delete");
  });

  it("refuses an already deleted account without writing", async () => {
    const h = harness({ ...active, accountStatus: "deleted" });
    const result = await deleteMentor(h.strapi, "mentor-7");
    expect(result).toEqual({ error: "Contul a fost deja șters.", status: 400 });
    expect(h.edits).toEqual([]);
    expect(h.hardDeleted).toEqual([]);
    expect(h.revoked).toEqual([]);
  });

  it("refuses a non-mentor target", async () => {
    const h = harness({ ...active, role: { type: "ngo-admin" } });
    const result = await deleteMentor(h.strapi, "mentor-7");
    expect(result).toMatchObject({ status: 400 });
    expect(h.edits).toEqual([]);
    expect(h.hardDeleted).toEqual([]);
  });

  it("returns 404 for an unknown account", async () => {
    const h = harness(null);
    const result = await deleteMentor(h.strapi, "nope");
    expect(result).toEqual({ error: "Utilizatorul nu a fost găsit", status: 404 });
  });

  it("runs inside a single transaction", async () => {
    for (const user of [pending, active]) {
      const h = harness(user);
      await deleteMentor(h.strapi, "mentor-7");
      expect(h.transactionCount()).toBe(1);
    }
  });
});
