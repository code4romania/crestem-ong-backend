import { describe, expect, it, vi } from "vitest";
import {
  memberView,
  reminderBlocker,
  resolveMembers,
  sendInvites,
  sendReminder,
} from "./members";

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

const inviteStrapi = (sent: any[]) => ({
  service: () => ({
    sendEvaluationInvite: async (args: any) => {
      sent.push(args);
    },
  }),
  documents: () => ({ update: async () => undefined }),
});

const respondent = (roleType: string) => ({
  member: {
    documentId: "u1",
    nume: "Ana Pop",
    email: "ana@example.com",
    role: { type: roleType },
  },
  evaluationDocumentId: "eval-1",
});

describe("sendInvites", () => {
  it("mails an ngo-member the wizard link for the round's organization", async () => {
    process.env.FRONTEND_URL = "https://crestem.ong";
    const sent: any[] = [];

    await sendInvites(
      inviteStrapi(sent),
      [respondent("ngo-member")],
      "Asociația Test",
      "ong-1",
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].link).toBe("https://crestem.ong/dashboard/ong-1/evaluari/eval-1");
  });

  it("sends nothing to an ngo-admin, who only ever gets here by adding themselves", async () => {
    // The admin's wizard is a different route, and the candidate list they pick
    // from holds ngo-members only, so an ngo-admin row is always their own
    // self-invite — an email to themselves, carrying a link that 404s for them.
    const sent: any[] = [];

    const result = await sendInvites(
      inviteStrapi(sent),
      [respondent("ngo-admin")],
      "Asociația Test",
      "ong-1",
    );

    expect(sent).toEqual([]);
    expect(result).toEqual({ emailSent: true, failed: [] });
  });
});

const pendingEvaluation = (user: Record<string, unknown> = {}) => ({
  documentId: "eval-1",
  user: {
    documentId: "u1",
    nume: "Ana Pop",
    email: "ana@example.com",
    accountStatus: "active",
    role: { type: "ngo-member" },
    ong: [{ documentId: "ong-1" }],
    ...user,
  },
});

describe("reminderBlocker", () => {
  it("lets the admin remind an ngo-member who has not finished", () => {
    expect(
      reminderBlocker(pendingEvaluation(), "admin-1", "ong-1", false),
    ).toBeNull();
  });

  it("refuses the admin's own evaluation", () => {
    expect(
      reminderBlocker(
        pendingEvaluation({ documentId: "admin-1", role: { type: "ngo-admin" } }),
        "admin-1",
        "ong-1",
        false,
      ),
    ).toBe("Nu îți poți trimite reminder ție");
  });

  it("refuses a completed evaluation", () => {
    expect(
      reminderBlocker(pendingEvaluation(), "admin-1", "ong-1", true),
    ).toBe("Membrul a completat deja evaluarea");
  });

  it("refuses a deleted account", () => {
    expect(
      reminderBlocker(
        pendingEvaluation({ accountStatus: "deleted", ong: [] }),
        "admin-1",
        "ong-1",
        false,
      ),
    ).toBe("Utilizatorul Ana Pop și-a șters contul");
  });

  it("refuses a member who has since left the organization", () => {
    expect(
      reminderBlocker(pendingEvaluation({ ong: [] }), "admin-1", "ong-1", false),
    ).toBe("Utilizatorul Ana Pop nu mai este membru al organizației");
  });
});

describe("sendReminder", () => {
  it("mails the wizard link and stamps notificationSentAt", async () => {
    process.env.FRONTEND_URL = "https://crestem.ong";
    const sent: any[] = [];
    const updates: any[] = [];
    const strapi = {
      service: () => ({
        sendEvaluationReminder: async (args: any) => {
          sent.push(args);
        },
      }),
      documents: () => ({
        update: async (args: any) => {
          updates.push(args);
        },
      }),
    };

    const result = await sendReminder(
      strapi,
      pendingEvaluation(),
      "Asociația Test",
      "ong-1",
      "2026-11-15",
    );

    expect(result).toEqual({ emailSent: true });
    expect(sent).toEqual([
      {
        to: "ana@example.com",
        nume: "Ana Pop",
        ongName: "Asociația Test",
        link: "https://crestem.ong/dashboard/ong-1/evaluari/eval-1",
        deadline: "2026-11-15",
      },
    ]);
    expect(updates[0].documentId).toBe("eval-1");
    expect(updates[0].data.notificationSentAt).toEqual(expect.any(String));
  });

  it("reports a failed delivery without stamping the evaluation", async () => {
    const updates: any[] = [];
    const strapi = {
      service: () => ({
        sendEvaluationReminder: async () => {
          throw new Error("smtp down");
        },
      }),
      documents: () => ({
        update: async (args: any) => {
          updates.push(args);
        },
      }),
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendReminder(strapi, pendingEvaluation(), "Asociația Test", "ong-1");

    expect(result).toEqual({ emailSent: false });
    expect(updates).toEqual([]);
    spy.mockRestore();
  });
});
