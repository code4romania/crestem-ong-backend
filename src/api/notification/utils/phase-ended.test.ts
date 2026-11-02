import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./recipients", () => ({
  fdscStaff: vi.fn(),
  ongAdmins: vi.fn(),
  activeAmong: vi.fn(),
}));

import { activeAmong, fdscStaff, ongAdmins } from "./recipients";
import {
  backfillPhaseEndNotified,
  endNotifiedOnCreate,
  endNotifiedReset,
  notifyEndedPhases,
} from "./phase-ended";
import { todayInBucharest } from "../../../utils/date";

const notify = vi.fn();
const findMany = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const storeGet = vi.fn();
const storeSet = vi.fn();
const logError = vi.fn();
const strapi = {
  service: () => ({ notify }),
  documents: () => ({ findMany, update }),
  db: { query: () => ({ updateMany }), transaction: (cb: () => unknown) => cb() },
  store: () => ({ get: storeGet, set: storeSet }),
  log: { error: logError, info: vi.fn() },
};

const phase = (documentId: string, program: any = null) => ({
  documentId,
  title: `Faza ${documentId}`,
  program: program ?? {
    documentId: "p1",
    name: "Program",
    ongs: [{ id: 5 }],
    mentors: [{ id: 30 }, { id: 31 }],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  notify.mockResolvedValue(1);
  update.mockResolvedValue({});
  vi.mocked(fdscStaff).mockResolvedValue([1, 2]);
  vi.mocked(ongAdmins).mockResolvedValue([20, 1]);
  vi.mocked(activeAmong).mockResolvedValue([30]);
});

describe("notifyEndedPhases", () => {
  it("notifies the union of staff, ONG admins and active mentors, then sets the marker", async () => {
    findMany.mockResolvedValue([phase("a")]);
    await notifyEndedPhases(strapi);
    expect(ongAdmins).toHaveBeenCalledWith(strapi, [5]);
    expect(activeAmong).toHaveBeenCalledWith(strapi, [30, 31]);
    const call = notify.mock.calls[0][0];
    expect(call.recipients).toEqual([1, 2, 20, 1, 30]);
    expect(call.type).toBe("phase-ended");
    expect(call.title).toBe("Fază încheiată");
    expect(call.body).toBe('Faza „Faza a” din programul Program s-a încheiat.');
    expect(update).toHaveBeenCalledWith({
      documentId: "a",
      data: { endNotifiedAt: expect.any(String) },
    });
  });

  it("links staff to the program and everyone else to the list", async () => {
    findMany.mockResolvedValue([phase("a")]);
    await notifyEndedPhases(strapi);
    const { link } = notify.mock.calls[0][0];
    expect(link(1)).toBe("/dashboard/programe/p1");
    expect(link(2)).toBe("/dashboard/programe/p1");
    expect(link(20)).toBe("/dashboard/programe");
    expect(link(30)).toBe("/dashboard/programe");
  });

  it("leaves the marker null when notify fails, and keeps going", async () => {
    findMany.mockResolvedValue([phase("a"), phase("b")]);
    notify.mockRejectedValueOnce(new Error("db down"));
    await notifyEndedPhases(strapi);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].documentId).toBe("b");
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("isolates a failing recipient lookup", async () => {
    findMany.mockResolvedValue([phase("a"), phase("b")]);
    vi.mocked(ongAdmins).mockRejectedValueOnce(new Error("boom"));
    await notifyEndedPhases(strapi);
    expect(update.mock.calls.map((c) => c[0].documentId)).toEqual(["b"]);
  });

  it("looks up FDSC staff once per run", async () => {
    findMany.mockResolvedValue([phase("a"), phase("b")]);
    await notifyEndedPhases(strapi);
    expect(fdscStaff).toHaveBeenCalledTimes(1);
  });

  it("marks a phase without program without notifying", async () => {
    findMany.mockResolvedValue([{ documentId: "x", title: "T", program: null }]);
    await notifyEndedPhases(strapi);
    expect(notify).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("backfillPhaseEndNotified", () => {
  it("marks past unmarked phases once, then sets the flag", async () => {
    storeGet.mockResolvedValue(null);
    await backfillPhaseEndNotified(strapi);
    expect(updateMany).toHaveBeenCalledWith({
      where: { endDate: { $lt: todayInBucharest() }, endNotifiedAt: null },
      data: { endNotifiedAt: expect.any(String) },
    });
    expect(storeSet).toHaveBeenCalledWith({ key: "phaseEndBackfillDone", value: true });
  });

  it("does nothing once the flag is set", async () => {
    storeGet.mockResolvedValue(true);
    await backfillPhaseEndNotified(strapi);
    expect(updateMany).not.toHaveBeenCalled();
    expect(storeSet).not.toHaveBeenCalled();
  });

  it("logs without throwing or setting the flag when the update fails", async () => {
    storeGet.mockResolvedValue(null);
    updateMany.mockRejectedValue(new Error("x"));
    await expect(backfillPhaseEndNotified(strapi)).resolves.toBeUndefined();
    expect(storeSet).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe("endNotifiedReset", () => {
  it("resets for today and future end dates", () => {
    const today = todayInBucharest();
    expect(endNotifiedReset(today)).toEqual({ endNotifiedAt: null });
    expect(endNotifiedReset("2999-01-01")).toEqual({ endNotifiedAt: null });
  });
  it("leaves past end dates untouched", () => {
    expect(endNotifiedReset("2020-01-01")).toEqual({});
  });
});

describe("endNotifiedOnCreate", () => {
  it("marks a phase created in the past as already notified", () => {
    expect(endNotifiedOnCreate("2020-01-01")).toEqual({
      endNotifiedAt: expect.any(String),
    });
  });
  it("leaves today and future phases unmarked", () => {
    expect(endNotifiedOnCreate(todayInBucharest())).toEqual({});
    expect(endNotifiedOnCreate("2999-01-01")).toEqual({});
  });
});
