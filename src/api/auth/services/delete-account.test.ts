import { describe, expect, it, vi, beforeEach } from "vitest";
import { performAccountDeletion } from "./delete-account";

const membership = vi.hoisted(() => ({ removeOngMembership: vi.fn(async () => ({})) }));
vi.mock("../../../utils/membership", () => membership);

interface Harness {
  strapi: any;
  edits: Array<{ id: number; data: any; inTransaction: boolean }>;
  deletedJoinRequests: string[];
  documentUpdates: Array<{ uid: string; data: any }>;
  revoked: number[];
  removedFiles: Array<{ file: any; inTransaction: boolean }>;
  deletedFileRows: Array<{ where: any; inTransaction: boolean }>;
  userQueries: any[];
  callOrder: { fileRemove: number[]; fileRowDelete: number[]; edit: number[] };
  transactionCount: () => number;
}

interface HarnessOptions {
  superAdminCount?: number;
  joinRequests?: any[];
  /** Makes the upload provider's `delete` reject, as a missing file would. */
  providerThrows?: boolean;
  /** Makes the `plugin::upload.file` row delete reject, as a database error would. */
  fileRowDeleteThrows?: boolean;
}

function harness(user: any, options: HarnessOptions = {}): Harness {
  const { superAdminCount = 2, joinRequests = [] } = options;
  const edits: Array<{ id: number; data: any; inTransaction: boolean }> = [];
  const deletedJoinRequests: string[] = [];
  const documentUpdates: Array<{ uid: string; data: any }> = [];
  const revoked: number[] = [];
  const removedFiles: Array<{ file: any; inTransaction: boolean }> = [];
  const deletedFileRows: Array<{ where: any; inTransaction: boolean }> = [];
  const userQueries: any[] = [];
  const callOrder = {
    fileRemove: [] as number[],
    fileRowDelete: [] as number[],
    edit: [] as number[],
  };
  let seq = 0;
  let inTransaction = false;
  let transactions = 0;

  const strapi = {
    db: {
      transaction: async (cb: () => Promise<unknown>) => {
        transactions += 1;
        inTransaction = true;
        try {
          return await cb();
        } finally {
          inTransaction = false;
        }
      },
      query: (uid: string) => ({
        findOne: vi.fn(async (params: any) => {
          if (uid !== "plugin::users-permissions.user") return null;
          userQueries.push(params);
          return user;
        }),
        count: vi.fn(async () => superAdminCount),
        delete: vi.fn(async ({ where }: any) => {
          expect(uid).toBe("plugin::upload.file");
          callOrder.fileRowDelete.push(seq++);
          if (options.fileRowDeleteThrows) {
            throw new Error("current transaction is aborted");
          }
          deletedFileRows.push({ where, inTransaction });
        }),
      }),
    },
    config: {
      get: vi.fn((key: string) =>
        key === "plugin::upload" ? { provider: "local" } : undefined,
      ),
    },
    documents: (uid: string) => ({
      findMany: vi.fn(async () =>
        uid === "api::ong-join-request.ong-join-request" ? joinRequests : [],
      ),
      delete: vi.fn(async ({ documentId }: any) => {
        deletedJoinRequests.push(documentId);
      }),
      update: vi.fn(async ({ data }: any) => {
        documentUpdates.push({ uid, data });
      }),
    }),
    plugin: (name: string) => ({
      service: (service: string) => ({
        validatePassword: vi.fn(async (plain: string) => plain === "correct"),
        edit: vi.fn(async (id: number, data: any) => {
          callOrder.edit.push(seq++);
          edits.push({ id, data, inTransaction });
        }),
      }),
      provider: {
        delete: vi.fn(async (file: any) => {
          expect(name).toBe("upload");
          callOrder.fileRemove.push(seq++);
          if (options.providerThrows) throw new Error("file not found");
          removedFiles.push({ file, inTransaction });
        }),
      },
    }),
    service: () => ({
      revokeAllForUser: vi.fn(async (id: number) => {
        revoked.push(id);
      }),
    }),
  };

  return {
    strapi,
    edits,
    deletedJoinRequests,
    documentUpdates,
    revoked,
    removedFiles,
    deletedFileRows,
    userQueries,
    callOrder,
    transactionCount: () => transactions,
  };
}

const activeMember = {
  id: 7,
  documentId: "user-7",
  accountStatus: "active",
  password: "hash",
  role: { type: "ngo-member" },
  ong: [{ documentId: "ong-1" }, { documentId: "ong-2" }],
};

beforeEach(() => {
  membership.removeOngMembership.mockClear();
});

describe("performAccountDeletion", () => {
  it("rejects a wrong current password", async () => {
    const h = harness(activeMember);
    await expect(
      performAccountDeletion(h.strapi, 7, { currentPassword: "wrong" }),
    ).rejects.toThrow("Parola actuală este incorectă");
    expect(h.edits).toHaveLength(0);
  });

  it("rejects an account that is not active", async () => {
    const h = harness({ ...activeMember, accountStatus: "deleted" });
    await expect(
      performAccountDeletion(h.strapi, 7, { currentPassword: "correct" }),
    ).rejects.toThrow("Contul nu a fost găsit");
  });

  it("rejects the contact person of an organization", async () => {
    const h = harness({ ...activeMember, role: { type: "ngo-admin" } });
    await expect(
      performAccountDeletion(h.strapi, 7, { currentPassword: "correct" }),
    ).rejects.toThrow("persoana de contact");
    expect(h.edits).toHaveLength(0);
  });

  it("rejects the last platform administrator", async () => {
    const h = harness({ ...activeMember, role: { type: "super-admin" } }, {
      superAdminCount: 1,
    });
    await expect(
      performAccountDeletion(h.strapi, 7, { currentPassword: "correct" }),
    ).rejects.toThrow("ultimul administrator");
  });

  it("ends every organization membership", async () => {
    const h = harness(activeMember);
    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });
    expect(membership.removeOngMembership).toHaveBeenCalledTimes(2);
    expect(membership.removeOngMembership).toHaveBeenCalledWith(h.strapi, "user-7", "ong-1");
    expect(membership.removeOngMembership).toHaveBeenCalledWith(h.strapi, "user-7", "ong-2");
  });

  it("revokes refresh tokens", async () => {
    const h = harness(activeMember);
    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });
    expect(h.revoked).toEqual([7]);
  });

  // BR-34: the mentoring assignment survives the deletion, so the organization
  // keeps seeing the anonymized person's conversation, meetings and reports.
  // Detaching invalidated the (program, mentor) pair and the chat disappeared.
  it("leaves the program and ngo-mentor assignments in place", async () => {
    const h = harness({ ...activeMember, role: { type: "mentor" }, ong: [] });
    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });
    expect(h.documentUpdates).toHaveLength(0);
  });

  it("voids pending join requests", async () => {
    const h = harness(activeMember, {
      joinRequests: [{ documentId: "jr-1" }, { documentId: "jr-2" }],
    });
    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });
    expect(h.deletedJoinRequests).toEqual(["jr-1", "jr-2"]);
  });

  it("anonymizes the account and scrambles the password", async () => {
    const h = harness(activeMember);
    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });
    expect(h.edits).toHaveLength(1);
    const { id, data } = h.edits[0];
    expect(id).toBe(7);
    expect(data.nume).toBe("Anonim user-7");
    expect(data.email).toBe("deleted-user-7@anonim.local");
    expect(data.accountStatus).toBe("deleted");
    expect(typeof data.password).toBe("string");
    expect(data.password.length).toBeGreaterThanOrEqual(32);
  });

  it("runs the whole cascade inside a single database transaction", async () => {
    const h = harness({ ...activeMember, avatar: { id: 9, provider: "local" } });
    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });

    expect(h.transactionCount()).toBe(1);
    expect(h.edits.every((e) => e.inTransaction)).toBe(true);
    // The `plugin::upload.file` row delete joins the transaction too; only the
    // provider's own disk/S3 delete sits outside it.
    expect(h.removedFiles.every((f) => f.inTransaction)).toBe(true);
    expect(h.deletedFileRows.every((r) => r.inTransaction)).toBe(true);
  });

  it("deletes the avatar file itself, not only the relation", async () => {
    const h = harness({
      ...activeMember,
      avatar: { id: 9, provider: "local", url: "/uploads/ana_pop_portret.jpg" },
    });

    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });

    // The avatar has to be populated on the load, otherwise there is nothing to
    // delete once `buildAnonymizedUserData` severs the relation.
    expect(h.userQueries).toHaveLength(1);
    expect(h.userQueries[0].populate).toEqual(["role", "ong", "avatar"]);

    expect(h.removedFiles.map((f) => f.file)).toEqual([
      { id: 9, provider: "local", url: "/uploads/ana_pop_portret.jpg" },
    ]);
    expect(h.deletedFileRows.map((r) => r.where)).toEqual([{ id: 9 }]);
    // The file goes before the relation is cleared, otherwise it can never be
    // located again.
    expect(h.callOrder.fileRemove[0]).toBeLessThan(h.callOrder.edit[0]);
    expect(h.edits[0].data.avatar).toBeNull();
  });

  it("does not call the upload service for an account with no avatar", async () => {
    const h = harness(activeMember);
    await performAccountDeletion(h.strapi, 7, { currentPassword: "correct" });
    expect(h.callOrder.fileRemove).toHaveLength(0);
    expect(h.callOrder.fileRowDelete).toHaveLength(0);
    expect(h.edits).toHaveLength(1);
  });

  it("still anonymizes the account when the avatar file is already gone", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness(
      { ...activeMember, avatar: { id: 9, provider: "local" } },
      { providerThrows: true },
    );

    await expect(
      performAccountDeletion(h.strapi, 7, { currentPassword: "correct" }),
    ).resolves.toBeUndefined();

    expect(h.callOrder.fileRemove).toHaveLength(1);
    // The media-library row still goes, so the anonymized account is not left
    // pointing at a file nothing can purge later.
    expect(h.deletedFileRows.map((r) => r.where)).toEqual([{ id: 9 }]);
    expect(h.edits).toHaveLength(1);
    expect(h.edits[0].data.accountStatus).toBe("deleted");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("aborts the deletion when the avatar's media-library row cannot be deleted", async () => {
    // A database failure here poisons the surrounding Postgres transaction.
    // Swallowing it would make the *next* write fail with "current transaction
    // is aborted" and hide the real cause in a console line.
    const h = harness(
      { ...activeMember, avatar: { id: 9, provider: "local" } },
      { fileRowDeleteThrows: true },
    );

    await expect(
      performAccountDeletion(h.strapi, 7, { currentPassword: "correct" }),
    ).rejects.toThrow("current transaction is aborted");

    expect(h.edits).toHaveLength(0);
  });
});
