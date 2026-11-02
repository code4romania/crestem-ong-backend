import { describe, expect, it, vi } from "vitest";
import { createNotifications } from "./notify";
import {
  listForUser,
  markAllRead,
  markRead,
  parsePaging,
  unreadCount,
} from "./queries";
import { fdscAdmins, fdscStaff, ongAdmins } from "./recipients";
import { formatRoDate, formatRoTime } from "./format";

const base = {
  type: "meeting-created" as const,
  title: "Întâlnire nouă",
  body: "corp",
};

describe("createNotifications", () => {
  it("creates one row per distinct recipient and drops falsy ids", async () => {
    const create = vi.fn().mockResolvedValue({});
    const strapi = { documents: () => ({ create }), db: { transaction: (cb: () => unknown) => cb() } };

    const count = await createNotifications(strapi, {
      ...base,
      recipients: [3, 3, 0, null, undefined, 7],
      link: "/dashboard/x",
    });

    expect(count).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipient: { connect: [{ id: 3 }] },
        type: "meeting-created",
        link: "/dashboard/x",
      }),
    });
  });

  it("runs all creates inside one transaction and propagates a mid-loop failure", async () => {
    const create = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("x"));
    const transaction = vi.fn((cb: () => unknown) => cb());
    const strapi = { documents: () => ({ create }), db: { transaction } };

    await expect(
      createNotifications(strapi, { ...base, recipients: [1, 2] }),
    ).rejects.toThrow("x");
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("creates nothing when there are no recipients", async () => {
    const create = vi.fn();
    const strapi = { documents: () => ({ create }), db: { transaction: (cb: () => unknown) => cb() } };

    expect(await createNotifications(strapi, { ...base, recipients: [] })).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("resolves a per-recipient link", async () => {
    const create = vi.fn().mockResolvedValue({});
    const strapi = { documents: () => ({ create }), db: { transaction: (cb: () => unknown) => cb() } };

    await createNotifications(strapi, {
      ...base,
      recipients: [1, 2],
      link: (id) => (id === 1 ? "/dashboard/programe/p1" : "/dashboard/programe"),
    });

    const links = create.mock.calls.map(([arg]) => arg.data.link);
    expect(links).toEqual(["/dashboard/programe/p1", "/dashboard/programe"]);
  });
});

describe("parsePaging", () => {
  it("defaults to start 0, limit 20", () => {
    expect(parsePaging({})).toEqual({ start: 0, limit: 20 });
  });

  it("clamps limit to 50", () => {
    expect(parsePaging({ start: "40", limit: "500" })).toEqual({ start: 40, limit: 50 });
  });

  it.each([{ start: "-1" }, { start: "1.5" }, { limit: "abc" }, { limit: "0" }, { limit: ["1", "2"] }])(
    "rejects %j",
    (query) => {
      expect(parsePaging(query)).toBeNull();
    },
  );
});

describe("listForUser", () => {
  const row = (n: number) => ({
    documentId: `n${n}`,
    type: "phase-ended",
    title: "t",
    body: "b",
    link: null,
    readAt: null,
    createdAt: "2026-10-30T10:00:00.000Z",
    extra: "dropped",
  });

  it("scopes to the caller, newest first, and reads one extra row", async () => {
    const findMany = vi.fn().mockResolvedValue([row(1), row(2), row(3)]);
    const strapi = { documents: () => ({ findMany }) };

    const result = await listForUser(strapi, 9, { start: 0, limit: 2 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { recipient: { id: 9 } },
        sort: [{ createdAt: "desc" }, { id: "desc" }],
        start: 0,
        limit: 3,
      }),
    );
    expect(result.data.map((n) => n.documentId)).toEqual(["n1", "n2"]);
    expect(result.data[0]).not.toHaveProperty("extra");
    expect(result.meta).toEqual({ start: 0, limit: 2, hasMore: true });
  });

  it("reports hasMore false on the last page", async () => {
    const findMany = vi.fn().mockResolvedValue([row(1), row(2)]);
    const strapi = { documents: () => ({ findMany }) };

    const result = await listForUser(strapi, 9, { start: 20, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({ start: 20, limit: 2, hasMore: false });
  });
});

describe("unreadCount", () => {
  it("counts the caller's rows without readAt", async () => {
    const count = vi.fn().mockResolvedValue(4);
    const strapi = { documents: () => ({ count }) };

    expect(await unreadCount(strapi, 9)).toBe(4);
    expect(count).toHaveBeenCalledWith({
      filters: { recipient: { id: 9 }, readAt: { $null: true } },
    });
  });
});

describe("markRead", () => {
  it("refuses a notification that is not the caller's", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const strapi = { documents: () => ({ findFirst, update }) };

    expect(await markRead(strapi, 9, "other")).toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      filters: { documentId: "other", recipient: { id: 9 } },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("sets readAt on an unread notification", async () => {
    const findFirst = vi.fn().mockResolvedValue({ documentId: "n1", readAt: null });
    const update = vi
      .fn()
      .mockResolvedValue({ documentId: "n1", readAt: "2026-10-30T10:00:00.000Z" });
    const strapi = { documents: () => ({ findFirst, update }) };

    const view = await markRead(strapi, 9, "n1");

    expect(update).toHaveBeenCalledWith({
      documentId: "n1",
      data: { readAt: expect.any(String) },
    });
    expect(view?.readAt).toBe("2026-10-30T10:00:00.000Z");
  });

  it("is idempotent for an already read notification", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ documentId: "n1", readAt: "2026-10-29T10:00:00.000Z" });
    const update = vi.fn();
    const strapi = { documents: () => ({ findFirst, update }) };

    const view = await markRead(strapi, 9, "n1");

    expect(update).not.toHaveBeenCalled();
    expect(view?.readAt).toBe("2026-10-29T10:00:00.000Z");
  });
});

describe("markAllRead", () => {
  it("updates only the caller's unread rows", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 5 }, { id: 8 }]);
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const strapi = { db: { query: () => ({ findMany, updateMany }) } };

    expect(await markAllRead(strapi, 9)).toBe(2);
    expect(findMany).toHaveBeenCalledWith({
      select: ["id"],
      where: { recipient: { id: 9 }, readAt: null },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { $in: [5, 8] } },
      data: { readAt: expect.any(Date) },
    });
  });

  it("writes nothing when there is nothing unread", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const updateMany = vi.fn();
    const strapi = { db: { query: () => ({ findMany, updateMany }) } };

    expect(await markAllRead(strapi, 9)).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("recipients", () => {
  it("fdscAdmins reads active, unblocked super-admins", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const strapi = { documents: () => ({ findMany }) };

    expect(await fdscAdmins(strapi)).toEqual([1, 2]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          role: { type: { $in: ["super-admin"] } },
          accountStatus: "active",
          $or: [{ blocked: false }, { blocked: { $null: true } }],
        },
      }),
    );
  });

  it("fdscStaff adds editor-fdsc", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 1 }]);
    const strapi = { documents: () => ({ findMany }) };

    await fdscStaff(strapi);

    expect(findMany.mock.calls[0][0].filters.role.type.$in).toEqual([
      "super-admin",
      "editor-fdsc",
    ]);
  });

  it("ongAdmins matches ids and documentIds, and skips the query when empty", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 4 }]);
    const strapi = { documents: () => ({ findMany }) };

    expect(await ongAdmins(strapi, [])).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();

    expect(await ongAdmins(strapi, [10, "doc-1"])).toEqual([4]);
    expect(findMany.mock.calls[0][0].filters).toEqual({
      role: { type: "ngo-admin" },
      accountStatus: "active",
      $and: [
        { $or: [{ blocked: false }, { blocked: { $null: true } }] },
        { $or: [{ ong: { id: { $in: [10] } } }, { ong: { documentId: { $in: ["doc-1"] } } }] },
      ],
    });
  });
});

describe("Romanian date formatting", () => {
  it("formats in Europe/Bucharest", () => {
    // 08:00 UTC on 5 Nov is 10:00 in Bucharest (UTC+2).
    expect(formatRoDate("2026-11-05T08:00:00.000Z")).toBe("5 nov. 2026");
    expect(formatRoTime("2026-11-05T08:00:00.000Z")).toBe("10:00");
  });

  it("rolls over to the local day", () => {
    expect(formatRoDate("2026-11-04T22:30:00.000Z")).toBe("5 nov. 2026");
    expect(formatRoTime("2026-11-04T22:30:00.000Z")).toBe("00:30");
  });
});
