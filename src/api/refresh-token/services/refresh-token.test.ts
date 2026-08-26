import { describe, expect, it, vi } from "vitest";
import factory from "./refresh-token";
import { hashToken } from "../utils/refresh-token";

interface Row {
  id: number;
  tokenHash: string;
  familyId: string;
  user: { id: number; accountStatus: string } | null;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

const ACTIVE_USER = { id: 7, accountStatus: "active" };

function harness(rows: Partial<Row>[] = []) {
  let nextId = rows.length + 1;
  const store: Row[] = rows.map((row, index) => ({
    id: index + 1,
    tokenHash: "",
    familyId: "fam-1",
    user: ACTIVE_USER,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    userAgent: null,
    ...row,
  }));

  const warnings: string[] = [];

  const strapi = {
    log: { warn: (message: string) => warnings.push(message), info: vi.fn() },
    db: {
      query: () => ({
        findOne: async ({ where }: any) =>
          store.find((row) => row.tokenHash === where.tokenHash) ?? null,
        count: async ({ where }: any) =>
          store.filter(
            (row) =>
              row.familyId === where.familyId &&
              (where.revokedAt !== null || row.revokedAt === null),
          ).length,
        update: async ({ where, data }: any) => {
          const row = store.find((item) => item.id === where.id);
          if (row) Object.assign(row, data);
          return row;
        },
        updateMany: async ({ where, data }: any) => {
          const hit = store.filter(
            (row) => row.familyId === where.familyId && row.revokedAt === null,
          );
          hit.forEach((row) => Object.assign(row, data));
          return { count: hit.length };
        },
        create: async ({ data }: any) => {
          const row: Row = {
            id: nextId++,
            tokenHash: data.tokenHash,
            familyId: data.familyId,
            user: ACTIVE_USER,
            expiresAt: data.expiresAt,
            revokedAt: null,
            userAgent: data.userAgent ?? null,
          };
          store.push(row);
          return row;
        },
      }),
    },
  } as any;

  return { service: factory({ strapi }), store, warnings };
}

const live = (store: Row[]) => store.filter((row) => row.revokedAt === null);

describe("rotate", () => {
  it("revokes the presented token and issues a successor", async () => {
    const { service, store } = harness([{ tokenHash: hashToken("A") }]);

    const result = await service.rotate("A");

    expect(result.userId).toBe(7);
    expect(store[0].revokedAt).not.toBeNull();
    expect(live(store)).toHaveLength(1);
    expect(live(store)[0].tokenHash).toBe(hashToken(result.refreshToken));
  });

  // The bug: a Link prefetch and the click it precedes both carry the same
  // refresh cookie, so the second call lands with an already-rotated token
  // milliseconds later. Treating that as token theft killed the whole family
  // and logged the user out.
  it("issues a sibling when the same token is re-presented inside the grace window", async () => {
    const { service, store } = harness([
      { tokenHash: hashToken("A"), revokedAt: new Date(Date.now() - 200) },
      { tokenHash: hashToken("B") },
    ]);

    const result = await service.rotate("A");

    expect(result.refreshToken).toBeTruthy();
    const liveHashes = live(store).map((row) => row.tokenHash);
    expect(liveHashes).toContain(hashToken("B"));
    expect(liveHashes).toContain(hashToken(result.refreshToken));
  });

  it("revokes the family when a token is replayed after the grace window", async () => {
    const { service, store, warnings } = harness([
      { tokenHash: hashToken("A"), revokedAt: new Date(Date.now() - 5 * 60_000) },
      { tokenHash: hashToken("B") },
    ]);

    await expect(service.rotate("A")).rejects.toThrow(/Sesiune invalidă/);
    expect(live(store)).toHaveLength(0);
    expect(warnings.join(" ")).toMatch(/Reuse detected/);
  });

  it("refuses to resurrect a family that was already swept", async () => {
    const justNow = new Date(Date.now() - 200);
    const { service, store } = harness([
      { tokenHash: hashToken("A"), revokedAt: justNow },
      { tokenHash: hashToken("B"), revokedAt: justNow },
    ]);

    await expect(service.rotate("A")).rejects.toThrow(/Sesiune invalidă/);
    expect(live(store)).toHaveLength(0);
  });

  it("rejects an expired token", async () => {
    const { service } = harness([
      { tokenHash: hashToken("A"), expiresAt: new Date(Date.now() - 1000) },
    ]);

    await expect(service.rotate("A")).rejects.toThrow(/Sesiune invalidă/);
  });

  it("rejects a token whose user is no longer active", async () => {
    const { service } = harness([
      { tokenHash: hashToken("A"), user: { id: 7, accountStatus: "suspended" } },
    ]);

    await expect(service.rotate("A")).rejects.toThrow(/Sesiune invalidă/);
  });
});
