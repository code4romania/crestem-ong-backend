import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildAnonymizedOngData, performOngDeletion } from "./delete-ong";

const membership = vi.hoisted(() => ({ removeOngMembership: vi.fn(async () => ({})) }));
vi.mock("../../../utils/membership", () => membership);

const NGO_MENTOR_UID = "api::ngo-mentor.ngo-mentor";
const ONG_UID = "api::ong.ong";
const USER_UID = "plugin::users-permissions.user";
const JOIN_REQUEST_UID = "api::ong-join-request.ong-join-request";

interface HarnessOptions {
  joinRequests?: any[];
  /** Rows returned for `api::ngo-mentor.ngo-mentor` lookups. */
  ngoMentors?: any[];
  /** The organization as `documents(ONG_UID).findOne` returns it. */
  ong?: any;
  /** Makes the upload provider's `delete` reject, as a missing file would. */
  providerThrows?: boolean;
  /** Makes the `plugin::upload.file` row delete reject, as a database error would. */
  fileRowDeleteThrows?: boolean;
}

function harness(members: any[], options: HarnessOptions = {}) {
  const { joinRequests = [], ngoMentors = [], ong = { documentId: "ong-1" } } = options;
  const findManyCalls: Record<string, any[]> = {};
  const findOneCalls: Record<string, any[]> = {};
  const updates: Array<{ uid: string; documentId: string; data: any; inTransaction: boolean }> = [];
  const deletes: Array<{ uid: string; documentId: string }> = [];
  const removedFiles: Array<{ file: any; inTransaction: boolean }> = [];
  const deletedFileRows: Array<{ where: any; inTransaction: boolean }> = [];
  const callOrder = {
    removeMembership: [] as number[],
    joinRequestDelete: [] as number[],
    mentorDetach: [] as number[],
    fileRemove: [] as number[],
    fileRowDelete: [] as number[],
    ongUpdate: [] as number[],
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
      findMany: vi.fn(async (params: any) => {
        (findManyCalls[uid] ??= []).push(params);
        if (uid === USER_UID) return members;
        if (uid === JOIN_REQUEST_UID) return joinRequests;
        if (uid === NGO_MENTOR_UID) return ngoMentors;
        return [];
      }),
      findOne: vi.fn(async (params: any) => {
        (findOneCalls[uid] ??= []).push(params);
        return uid === ONG_UID ? ong : null;
      }),
      update: vi.fn(async ({ documentId, data }: any) => {
        updates.push({ uid, documentId, data, inTransaction });
        if (uid === ONG_UID) callOrder.ongUpdate.push(seq++);
        if (uid === NGO_MENTOR_UID) callOrder.mentorDetach.push(seq++);
      }),
      delete: vi.fn(async ({ documentId }: any) => {
        deletes.push({ uid, documentId });
        if (uid === JOIN_REQUEST_UID) {
          callOrder.joinRequestDelete.push(seq++);
        }
      }),
    }),
    plugin: (name: string) => ({
      provider: {
        delete: vi.fn(async (file: any) => {
          expect(name).toBe("upload");
          callOrder.fileRemove.push(seq++);
          if (options.providerThrows) throw new Error("file not found");
          removedFiles.push({ file, inTransaction });
        }),
      },
    }),
  };

  return {
    strapi,
    updates,
    deletes,
    removedFiles,
    deletedFileRows,
    findManyCalls,
    findOneCalls,
    callOrder,
    transactionCount: () => transactions,
    recordRemoveMembership: () => callOrder.removeMembership.push(seq++),
  };
}

beforeEach(() => {
  membership.removeOngMembership.mockReset();
  membership.removeOngMembership.mockImplementation(async () => ({}));
});

describe("buildAnonymizedOngData", () => {
  it("overwrites the identifying fields and marks the ONG deleted", () => {
    const data = buildAnonymizedOngData("ong-1");
    expect(data.name).toBe("Organizație ștearsă");
    expect(data.cui).toBe("deleted-ong-1");
    expect(data.website).toBeNull();
    expect(data.adresa).toBeNull();
    expect(data.descriere).toBeNull();
    expect(data.logo).toBeNull();
    expect(data.ngoStatus).toBe("deleted");
  });

  it("clears the re-identifying location, founding and domain fields", () => {
    const data = buildAnonymizedOngData("ong-1");
    // County + city + founding date + domain, against the program enrollment
    // and evaluation history BR-33 keeps, would re-identify most Romanian NGOs.
    expect(data.judet).toBeNull();
    expect(data.localitate).toBeNull();
    expect(data.dataInfiintare).toBeNull();
    expect(data.domeniuPrincipal).toBeNull();
    expect(data.domeniuSecundar).toBeNull();
  });

  it("is exactly the payload sent to the document service", () => {
    // `null` is the Strapi 5 relation input for "clear this relation", so the
    // four manyToOne fields are plain nulls like the scalars — no connect /
    // disconnect wrapper. The whole payload is asserted so a field cannot be
    // dropped or reshaped unnoticed.
    expect(buildAnonymizedOngData("ong-1")).toEqual({
      name: "Organizație ștearsă",
      cui: "deleted-ong-1",
      website: null,
      adresa: null,
      descriere: null,
      cuvinteCheie: null,
      socialMedia: null,
      logo: null,
      judet: null,
      localitate: null,
      dataInfiintare: null,
      domeniuPrincipal: null,
      domeniuSecundar: null,
      ngoStatus: "deleted",
    });
  });
});

describe("performOngDeletion", () => {
  it("ends every membership, admin included, scoped to this ONG only", async () => {
    const h = harness([
      { documentId: "u1", role: { type: "ngo-admin" } },
      { documentId: "u2", role: { type: "ngo-member" } },
    ]);

    await performOngDeletion(h.strapi, "ong-1");

    expect(membership.removeOngMembership).toHaveBeenCalledTimes(2);
    expect(membership.removeOngMembership).toHaveBeenCalledWith(h.strapi, "u1", "ong-1");
    expect(membership.removeOngMembership).toHaveBeenCalledWith(h.strapi, "u2", "ong-1");

    // The member lookup must scope to this ONG's documentId and carry no role
    // filter — every role (the ngo-admin included) has to come back.
    const memberQueries = h.findManyCalls[USER_UID];
    expect(memberQueries).toHaveLength(1);
    expect(memberQueries[0].filters).toEqual({ ong: { documentId: "ong-1" } });
  });

  it("voids pending join requests, scoped to this ONG and to pending status", async () => {
    const h = harness([], { joinRequests: [{ documentId: "jr-1" }] });
    await performOngDeletion(h.strapi, "ong-1");
    expect(h.deletes).toContainEqual({
      uid: JOIN_REQUEST_UID,
      documentId: "jr-1",
    });

    const joinRequestQueries = h.findManyCalls[JOIN_REQUEST_UID];
    expect(joinRequestQueries).toHaveLength(1);
    expect(joinRequestQueries[0].filters).toEqual({
      ong: { documentId: "ong-1" },
      status: "pending",
    });
  });

  it("runs the whole cascade inside a single database transaction", async () => {
    const h = harness([{ documentId: "u1", role: { type: "ngo-member" } }], {
      joinRequests: [{ documentId: "jr-1" }],
      ngoMentors: [{ documentId: "nm-1", ong: [{ documentId: "ong-1" }] }],
      ong: { documentId: "ong-1", logo: { id: 12, provider: "local" } },
    });

    await performOngDeletion(h.strapi, "ong-1");

    expect(h.transactionCount()).toBe(1);
    expect(h.updates.length).toBeGreaterThan(0);
    expect(h.updates.every((u) => u.inTransaction)).toBe(true);
    // The `plugin::upload.file` row delete joins the transaction too; only the
    // provider's own disk/S3 delete sits outside it.
    expect(h.removedFiles.every((f) => f.inTransaction)).toBe(true);
    expect(h.deletedFileRows.every((r) => r.inTransaction)).toBe(true);
  });

  it("ends the mentoring assignment, scoped to this ONG (BR-33)", async () => {
    const h = harness([], {
      ngoMentors: [
        { documentId: "nm-1", ong: [{ documentId: "ong-1" }] },
        { documentId: "nm-2", ong: [{ documentId: "ong-1" }, { documentId: "ong-9" }] },
      ],
    });

    await performOngDeletion(h.strapi, "ong-1");

    const mentorQueries = h.findManyCalls[NGO_MENTOR_UID];
    expect(mentorQueries).toHaveLength(1);
    expect(mentorQueries[0].filters).toEqual({ ong: { documentId: "ong-1" } });

    const mentorUpdates = h.updates.filter((u) => u.uid === NGO_MENTOR_UID);
    expect(mentorUpdates).toHaveLength(2);
    expect(mentorUpdates[0]).toMatchObject({ documentId: "nm-1", data: { ong: [] } });
    // Any other organization on the same row survives.
    expect(mentorUpdates[1]).toMatchObject({
      documentId: "nm-2",
      data: { ong: [{ documentId: "ong-9" }] },
    });
  });

  it("leaves ngo-mentor rows for other organizations untouched", async () => {
    const h = harness([], {
      ngoMentors: [{ documentId: "nm-3", ong: [{ documentId: "ong-9" }] }],
    });

    await performOngDeletion(h.strapi, "ong-1");

    expect(h.updates.filter((u) => u.uid === NGO_MENTOR_UID)).toHaveLength(0);
  });

  it("deletes the logo file itself, not only the relation", async () => {
    const h = harness([], {
      ong: {
        documentId: "ong-1",
        logo: { id: 41, provider: "local", url: "/uploads/logo-fundatia-x.png" },
      },
    });

    await performOngDeletion(h.strapi, "ong-1");

    const ongLookups = h.findOneCalls[ONG_UID];
    expect(ongLookups).toHaveLength(1);
    expect(ongLookups[0]).toEqual({
      documentId: "ong-1",
      populate: { logo: true },
    });
    expect(h.removedFiles.map((f) => f.file)).toEqual([
      { id: 41, provider: "local", url: "/uploads/logo-fundatia-x.png" },
    ]);
    expect(h.deletedFileRows.map((r) => r.where)).toEqual([{ id: 41 }]);

    // The file goes before the relation is cleared, otherwise it can never be
    // located again.
    expect(h.callOrder.fileRemove[0]).toBeLessThan(h.callOrder.ongUpdate[0]);
    const ongUpdate = h.updates.find((u) => u.uid === ONG_UID);
    expect(ongUpdate?.data.logo).toBeNull();
  });

  it("does not call the upload service for an organization with no logo", async () => {
    const h = harness([], { ong: { documentId: "ong-1", logo: null } });
    await performOngDeletion(h.strapi, "ong-1");
    expect(h.callOrder.fileRemove).toHaveLength(0);
    expect(h.callOrder.fileRowDelete).toHaveLength(0);
    expect(h.updates.find((u) => u.uid === ONG_UID)?.data.ngoStatus).toBe("deleted");
  });

  it("still anonymizes the organization when the logo file is already gone", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness([], {
      ong: { documentId: "ong-1", logo: { id: 41, provider: "local" } },
      providerThrows: true,
    });

    await expect(performOngDeletion(h.strapi, "ong-1")).resolves.toBeUndefined();

    expect(h.callOrder.fileRemove).toHaveLength(1);
    // The media-library row goes even when the provider object could not be
    // reached, so nothing is left pointing at an unpurgeable file.
    expect(h.deletedFileRows.map((r) => r.where)).toEqual([{ id: 41 }]);
    expect(h.updates.find((u) => u.uid === ONG_UID)?.data.ngoStatus).toBe("deleted");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("aborts the deletion when the logo's media-library row cannot be deleted", async () => {
    // A database failure here poisons the surrounding Postgres transaction:
    // swallowing it turns the anonymizing update below into a misleading
    // "current transaction is aborted" with the real cause only in a log line.
    const h = harness([], {
      ong: { documentId: "ong-1", logo: { id: 41, provider: "local" } },
      fileRowDeleteThrows: true,
    });

    await expect(performOngDeletion(h.strapi, "ong-1")).rejects.toThrow(
      "current transaction is aborted",
    );

    expect(h.updates.filter((u) => u.uid === ONG_UID)).toHaveLength(0);
  });

  it("anonymizes the organization last, after every membership ends and every join request is voided", async () => {
    const h = harness([{ documentId: "u1", role: { type: "ngo-member" } }], {
      joinRequests: [{ documentId: "jr-1" }],
      ngoMentors: [{ documentId: "nm-1", ong: [{ documentId: "ong-1" }] }],
    });
    membership.removeOngMembership.mockImplementation(async () => {
      h.recordRemoveMembership();
      return {};
    });

    await performOngDeletion(h.strapi, "ong-1");

    const ongUpdate = h.updates.find((u) => u.uid === ONG_UID);
    expect(ongUpdate?.documentId).toBe("ong-1");
    expect(ongUpdate?.data.ngoStatus).toBe("deleted");
    // The relations are cleared on the wire, not only in the builder.
    expect(ongUpdate?.data.judet).toBeNull();
    expect(ongUpdate?.data.localitate).toBeNull();
    expect(ongUpdate?.data.domeniuPrincipal).toBeNull();
    expect(ongUpdate?.data.domeniuSecundar).toBeNull();
    expect(ongUpdate?.data.dataInfiintare).toBeNull();

    expect(h.callOrder.removeMembership).toHaveLength(1);
    expect(h.callOrder.joinRequestDelete).toHaveLength(1);
    expect(h.callOrder.mentorDetach).toHaveLength(1);
    expect(h.callOrder.ongUpdate).toHaveLength(1);
    const maxBefore = Math.max(
      ...h.callOrder.removeMembership,
      ...h.callOrder.joinRequestDelete,
      ...h.callOrder.mentorDetach,
    );
    expect(h.callOrder.ongUpdate[0]).toBeGreaterThan(maxBefore);
  });
});
