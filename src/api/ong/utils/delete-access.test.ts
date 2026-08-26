import { describe, expect, it } from "vitest";
import {
  authorizeOngDeletion,
  decideOngDeletion,
  ONG_ALREADY_DELETED_MESSAGE,
  ONG_DELETE_FORBIDDEN_MESSAGE,
  ONG_NOT_FOUND_MESSAGE,
} from "./delete-access";

const ONG_UID = "api::ong.ong";
const USER_UID = "plugin::users-permissions.user";

interface HarnessOptions {
  /** Organizations keyed by documentId, as `documents(ONG_UID).findOne` returns them. */
  ongs?: Record<string, any>;
  /** Organizations the acting user belongs to, as stored on their user row. */
  memberships?: string[];
}

/**
 * A `strapi` double that records every document-service call, so a test can
 * assert not only the decision but the exact reads it was based on — and that
 * two different situations issued byte-identical queries.
 */
function harness(options: HarnessOptions = {}) {
  const { ongs = {}, memberships = [] } = options;
  const queries: Array<{ uid: string; op: string; params: any }> = [];

  const strapi = {
    documents: (uid: string) => ({
      findOne: async (params: any) => {
        queries.push({ uid, op: "findOne", params });
        if (uid === ONG_UID) {
          return ongs[params.documentId] ?? null;
        }
        if (uid === USER_UID) {
          return {
            documentId: params.documentId,
            ong: memberships.map((documentId) => ({ documentId })),
          };
        }
        return null;
      },
    }),
  };

  return { strapi, queries };
}

const activeOng = (documentId: string) => ({ documentId, ngoStatus: "active" });

describe("decideOngDeletion", () => {
  it("lets an ngo-admin delete an organization they belong to", () => {
    expect(
      decideOngDeletion({
        roleType: "ngo-admin",
        ownsTarget: true,
        targetExists: true,
        targetDeleted: false,
      }),
    ).toEqual({ outcome: "allowed" });
  });

  it("lets a super-admin delete an organization they do not belong to", () => {
    expect(
      decideOngDeletion({
        roleType: "super-admin",
        ownsTarget: false,
        targetExists: true,
        targetDeleted: false,
      }),
    ).toEqual({ outcome: "allowed" });
  });

  it("refuses an ngo-admin an organization they do not belong to", () => {
    expect(
      decideOngDeletion({
        roleType: "ngo-admin",
        ownsTarget: false,
        targetExists: true,
        targetDeleted: false,
      }),
    ).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
  });

  it("answers 'not mine' and 'does not exist' with the identical rejection", () => {
    // The whole decision object is compared, so a divergence in status, in
    // wording, or in any field added later fails here. If these two ever differ,
    // any ngo-admin can enumerate which organization documentIds exist.
    const notMine = decideOngDeletion({
      roleType: "ngo-admin",
      ownsTarget: false,
      targetExists: true,
      targetDeleted: false,
    });
    const doesNotExist = decideOngDeletion({
      roleType: "ngo-admin",
      ownsTarget: false,
      targetExists: false,
      targetDeleted: false,
    });
    expect(notMine).toEqual(doesNotExist);
    expect(notMine).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
  });

  it("hides an already-deleted organization behind the same rejection when it is not the caller's", () => {
    // `ngoStatus` must not leak either: "deja ștearsă" for a stranger's
    // organization would confirm both that it exists and what state it is in.
    expect(
      decideOngDeletion({
        roleType: "ngo-admin",
        ownsTarget: false,
        targetExists: true,
        targetDeleted: true,
      }),
    ).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
  });

  it("keeps the already-deleted guard for organizations the caller may act on", () => {
    const forOwner = decideOngDeletion({
      roleType: "ngo-admin",
      ownsTarget: true,
      targetExists: true,
      targetDeleted: true,
    });
    const forSuperAdmin = decideOngDeletion({
      roleType: "super-admin",
      ownsTarget: false,
      targetExists: true,
      targetDeleted: true,
    });
    const expected = {
      outcome: "denied",
      status: "badRequest",
      message: ONG_ALREADY_DELETED_MESSAGE,
    };
    expect(forOwner).toEqual(expected);
    expect(forSuperAdmin).toEqual(expected);
  });

  it("tells a super-admin when the organization does not exist", () => {
    expect(
      decideOngDeletion({
        roleType: "super-admin",
        ownsTarget: false,
        targetExists: false,
        targetDeleted: false,
      }),
    ).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
  });

  it("refuses every other role, even for an organization they belong to", () => {
    for (const roleType of [
      "ngo-member",
      "mentor",
      "individual",
      "authenticated",
      "",
      null,
      undefined,
    ]) {
      expect(
        decideOngDeletion({
          roleType,
          ownsTarget: true,
          targetExists: true,
          targetDeleted: false,
        }),
      ).toEqual({
        outcome: "denied",
        status: "forbidden",
        message: ONG_DELETE_FORBIDDEN_MESSAGE,
      });
    }
  });
});

describe("authorizeOngDeletion", () => {
  it("allows an ngo-admin whose stored memberships include the route's organization", async () => {
    const h = harness({
      ongs: { "ong-1": activeOng("ong-1") },
      memberships: ["ong-9", "ong-1"],
    });

    const decision = await authorizeOngDeletion(h.strapi, {
      actorDocumentId: "user-1",
      roleType: "ngo-admin",
      targetDocumentId: "ong-1",
    });

    expect(decision).toEqual({ outcome: "allowed" });
    // The membership set is read from the user's own row, keyed by the acting
    // user's documentId — not from anything the request carried.
    expect(h.queries).toEqual([
      { uid: ONG_UID, op: "findOne", params: { documentId: "ong-1" } },
      {
        uid: USER_UID,
        op: "findOne",
        params: { documentId: "user-1", populate: { ong: true } },
      },
    ]);
  });

  it("refuses an ngo-admin an existing organization they do not belong to", async () => {
    const h = harness({
      ongs: { "ong-1": activeOng("ong-1"), "ong-2": activeOng("ong-2") },
      memberships: ["ong-1"],
    });

    const decision = await authorizeOngDeletion(h.strapi, {
      actorDocumentId: "user-1",
      roleType: "ngo-admin",
      targetDocumentId: "ong-2",
    });

    expect(decision).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
  });

  it("is indistinguishable, decision and queries alike, between a stranger's organization and a non-existent one", async () => {
    // Same actor, same memberships; only the existence of the target differs.
    const strangerOng = harness({
      ongs: { "ong-1": activeOng("ong-1"), "ong-2": activeOng("ong-2") },
      memberships: ["ong-1"],
    });
    const noSuchOng = harness({
      ongs: { "ong-1": activeOng("ong-1") },
      memberships: ["ong-1"],
    });

    const call = (h: ReturnType<typeof harness>) =>
      authorizeOngDeletion(h.strapi, {
        actorDocumentId: "user-1",
        roleType: "ngo-admin",
        targetDocumentId: "ong-2",
      });

    const stranger = await call(strangerOng);
    const missing = await call(noSuchOng);

    expect(stranger).toEqual(missing);
    expect(stranger).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
    // Identical reads in identical order: the rejection cannot be told apart by
    // how much work the server did before answering either.
    expect(strangerOng.queries).toEqual(noSuchOng.queries);
  });

  it("lets a super-admin delete an organization they do not belong to, without reading memberships", async () => {
    const h = harness({ ongs: { "ong-2": activeOng("ong-2") }, memberships: [] });

    const decision = await authorizeOngDeletion(h.strapi, {
      actorDocumentId: "admin-1",
      roleType: "super-admin",
      targetDocumentId: "ong-2",
    });

    expect(decision).toEqual({ outcome: "allowed" });
    expect(h.queries).toEqual([
      { uid: ONG_UID, op: "findOne", params: { documentId: "ong-2" } },
    ]);
  });

  it("refuses an ngo-member without touching the database", async () => {
    const h = harness({
      ongs: { "ong-1": activeOng("ong-1") },
      memberships: ["ong-1"],
    });

    const decision = await authorizeOngDeletion(h.strapi, {
      actorDocumentId: "user-2",
      roleType: "ngo-member",
      targetDocumentId: "ong-1",
    });

    expect(decision).toEqual({
      outcome: "denied",
      status: "forbidden",
      message: ONG_DELETE_FORBIDDEN_MESSAGE,
    });
    expect(h.queries).toEqual([]);
  });

  it("refuses an ngo-admin whose user row carries no memberships at all", async () => {
    const h = harness({ ongs: { "ong-1": activeOng("ong-1") }, memberships: [] });

    expect(
      await authorizeOngDeletion(h.strapi, {
        actorDocumentId: "user-1",
        roleType: "ngo-admin",
        targetDocumentId: "ong-1",
      }),
    ).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
  });

  it("refuses an ngo-admin their own organization once it is already deleted", async () => {
    const h = harness({
      ongs: { "ong-1": { documentId: "ong-1", ngoStatus: "deleted" } },
      memberships: ["ong-1"],
    });

    expect(
      await authorizeOngDeletion(h.strapi, {
        actorDocumentId: "user-1",
        roleType: "ngo-admin",
        targetDocumentId: "ong-1",
      }),
    ).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_ALREADY_DELETED_MESSAGE,
    });
  });
});

describe("decideOngDeletion — FDSC editor", () => {
  it("lets an editor-fdsc delete an organization they do not belong to", () => {
    expect(
      decideOngDeletion({
        roleType: "editor-fdsc",
        ownsTarget: false,
        targetExists: true,
        targetDeleted: false,
      }),
    ).toEqual({ outcome: "allowed" });
  });

  it("tells an editor-fdsc when the organization does not exist", () => {
    expect(
      decideOngDeletion({
        roleType: "editor-fdsc",
        ownsTarget: false,
        targetExists: false,
        targetDeleted: false,
      }),
    ).toEqual({
      outcome: "denied",
      status: "badRequest",
      message: ONG_NOT_FOUND_MESSAGE,
    });
  });
});
