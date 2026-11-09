import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./recipients", () => ({
  activeAmong: vi.fn(),
  fdscAdmins: vi.fn(),
  fdscStaff: vi.fn(),
  ongAdmins: vi.fn(),
}));

import { ongAdmins } from "./recipients";
import { notifyPhasesEndingSoon, reminderTargetDay } from "./phase-ending-soon";
import { notifyPhaseDatesChanged, phasesWithChangedDates } from "./events";
import { phaseDatesChangedMessage, phaseEndingSoonMessage } from "./messages";
import { addDays, todayInBucharest } from "../../../utils/date";

const notify = vi.fn();
const findMany = vi.fn();
const findOne = vi.fn();
const update = vi.fn();
const logError = vi.fn();
const strapi = {
  service: () => ({ notify }),
  documents: () => ({ findMany, findOne, update }),
  db: { transaction: (cb: () => unknown) => cb() },
  log: { error: logError, info: vi.fn() },
};

beforeEach(() => {
  vi.resetAllMocks();
  notify.mockResolvedValue(1);
  update.mockResolvedValue({});
  vi.mocked(ongAdmins).mockResolvedValue([20, 21]);
});

describe("date helpers", () => {
  it("addDays crosses month and year ends", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("the reminder targets phases ending three days from today", () => {
    expect(reminderTargetDay("2026-11-17")).toBe("2026-11-20");
  });
});

describe("message builders", () => {
  it("phase-ending-soon: exact copy", () => {
    expect(
      phaseEndingSoonMessage({ phaseTitle: "Evaluare", programName: "SCA", endDate: "2026-11-20" }),
    ).toEqual({
      type: "phase-ending-soon",
      title: "Faza se încheie în curând",
      body: "Faza „Evaluare” din programul SCA se încheie pe 20.11.2026.",
      link: "/dashboard/programe",
    });
  });

  it("phase-dates-changed: exact copy", () => {
    expect(
      phaseDatesChangedMessage({
        phaseTitle: "Evaluare",
        programName: "SCA",
        startDate: "2026-11-01",
        endDate: "2026-11-25",
      }),
    ).toEqual({
      type: "phase-dates-changed",
      title: "Perioada fazei a fost modificată",
      body: "Faza „Evaluare” din programul SCA se desfășoară acum între 01.11.2026 și 25.11.2026.",
      link: "/dashboard/programe",
    });
  });
});

describe("notifyPhasesEndingSoon", () => {
  const target = reminderTargetDay(todayInBucharest());
  const phase = (documentId: string, program: any = { name: "SCA", ongs: [{ id: 5 }, { id: 6 }] }) => ({
    documentId,
    title: `Faza ${documentId}`,
    program,
  });

  it("looks only for phases ending on the target day not yet reminded for it", async () => {
    findMany.mockResolvedValue([]);
    await notifyPhasesEndingSoon(strapi);
    expect(findMany.mock.calls[0][0].filters).toEqual({
      endDate: target,
      $or: [
        { endReminderSentFor: { $null: true } },
        { endReminderSentFor: { $ne: target } },
      ],
    });
  });

  it("reminds the program's ONG admins, then records the end date", async () => {
    findMany.mockResolvedValue([phase("a")]);
    await notifyPhasesEndingSoon(strapi);
    expect(ongAdmins).toHaveBeenCalledWith(strapi, [5, 6]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipients: [20, 21],
      type: "phase-ending-soon",
      body: expect.stringContaining("Faza „Faza a” din programul SCA"),
    });
    expect(update).toHaveBeenCalledWith({
      documentId: "a",
      data: { endReminderSentFor: target },
    });
  });

  it("one reminder per phase", async () => {
    findMany.mockResolvedValue([phase("a"), phase("b")]);
    await notifyPhasesEndingSoon(strapi);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("a phase without ONG admins is marked without notifying", async () => {
    vi.mocked(ongAdmins).mockResolvedValue([]);
    findMany.mockResolvedValue([phase("a", { name: "SCA", ongs: [] })]);
    await notifyPhasesEndingSoon(strapi);
    expect(notify).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("a failing phase is logged, leaves no marker, and does not stop the others", async () => {
    findMany.mockResolvedValue([phase("a"), phase("b")]);
    notify.mockRejectedValueOnce(new Error("db"));
    await notifyPhasesEndingSoon(strapi);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].documentId).toBe("b");
  });
});

describe("phasesWithChangedDates", () => {
  const today = "2026-11-09";
  const before = [
    { documentId: "a", title: "A", startDate: "2026-11-01", endDate: "2026-11-20" },
    { documentId: "b", title: "B", startDate: "2026-10-01", endDate: "2026-10-20" },
  ];

  it("reports a moved end date with the new values", () => {
    expect(
      phasesWithChangedDates(
        before,
        [{ documentId: "a", title: "A", startDate: "2026-11-01", endDate: "2026-11-25" }],
        today,
      ),
    ).toEqual([{ title: "A", startDate: "2026-11-01", endDate: "2026-11-25" }]);
  });

  it("reports a moved start date", () => {
    expect(
      phasesWithChangedDates(
        before,
        [{ documentId: "a", title: "A", startDate: "2026-11-02", endDate: "2026-11-20" }],
        today,
      ),
    ).toHaveLength(1);
  });

  it("ignores unchanged dates, title edits and new phases", () => {
    expect(
      phasesWithChangedDates(
        before,
        [
          { documentId: "a", title: "A redenumită", startDate: "2026-11-01", endDate: "2026-11-20" },
          { title: "Nouă", startDate: "2026-11-21", endDate: "2026-11-30" },
        ],
        today,
      ),
    ).toEqual([]);
  });

  it("compares calendar days, whatever the stored value's shape", () => {
    expect(
      phasesWithChangedDates(
        [{ documentId: "a", title: "A", startDate: "2026-11-01T00:00:00.000Z", endDate: "2026-11-20" }],
        [{ documentId: "a", title: "A", startDate: "2026-11-01", endDate: "2026-11-20" }],
        today,
      ),
    ).toEqual([]);
  });

  it("skips a phase still ended after the edit", () => {
    expect(
      phasesWithChangedDates(
        before,
        [{ documentId: "b", title: "B", startDate: "2026-10-01", endDate: "2026-10-25" }],
        today,
      ),
    ).toEqual([]);
  });

  it("reports an ended phase moved back into the future", () => {
    expect(
      phasesWithChangedDates(
        before,
        [{ documentId: "b", title: "B", startDate: "2026-10-01", endDate: "2026-11-30" }],
        today,
      ),
    ).toEqual([{ title: "B", startDate: "2026-10-01", endDate: "2026-11-30" }]);
  });

  it("reports a phase ending today", () => {
    expect(
      phasesWithChangedDates(
        before,
        [{ documentId: "a", title: "A", startDate: "2026-11-01", endDate: today }],
        today,
      ),
    ).toHaveLength(1);
  });
});

describe("notifyPhaseDatesChanged", () => {
  const changed = [
    { title: "A", startDate: "2026-11-01", endDate: "2026-11-25" },
    { title: "B", startDate: "2026-11-26", endDate: "2026-12-10" },
  ];

  it("one notification per phase to the program's ONG admins", async () => {
    findOne.mockResolvedValue({ name: "SCA", ongs: [{ id: 5 }] });
    await notifyPhaseDatesChanged(strapi, { programDocumentId: "p1", phases: changed });
    expect(ongAdmins).toHaveBeenCalledWith(strapi, [5]);
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipients: [20, 21],
      type: "phase-dates-changed",
      body: "Faza „A” din programul SCA se desfășoară acum între 01.11.2026 și 25.11.2026.",
    });
    expect(notify.mock.calls[1][0].body).toContain("„B”");
  });

  it("does nothing without changed phases", async () => {
    await notifyPhaseDatesChanged(strapi, { programDocumentId: "p1", phases: [] });
    expect(findOne).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("never throws when notify fails", async () => {
    findOne.mockResolvedValue({ name: "SCA", ongs: [{ id: 5 }] });
    notify.mockRejectedValue(new Error("db"));
    await expect(
      notifyPhaseDatesChanged(strapi, { programDocumentId: "p1", phases: changed }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
