import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./recipients", () => ({
  fdscAdmins: vi.fn(),
  ongAdmins: vi.fn(),
}));

import { fdscAdmins, ongAdmins } from "./recipients";
import {
  newlyAssignedMentors,
  notifyAccountActivated,
  notifyMeetingCreated,
  notifyMeetingUpdated,
  notifyMentorAssigned,
  notifyOngAddedToProgram,
  notifyOngRegistered,
} from "./events";
import {
  accountActivatedMessage,
  adminTransferMessage,
  classifyMeetingChange,
  meetingChangeMessage,
  meetingCreatedMessage,
  memberJoinedMessage,
  mentorAssignedMessages,
  ongAddedToProgramMessage,
  ongRegisteredMessage,
} from "./messages";

const notify = vi.fn();
const error = vi.fn();
const strapi = {
  service: () => ({ notify }),
  log: { error },
};

beforeEach(() => {
  vi.clearAllMocks();
  notify.mockResolvedValue(1);
});

// 2026-11-05 10:00 Europe/Bucharest (UTC+2)
const NOV_5 = "2026-11-05T08:00:00.000Z";
const NOV_6 = "2026-11-06T09:30:00.000Z";

describe("message builders", () => {
  it("account-activated: mentor", () => {
    expect(
      accountActivatedMessage({ nume: "Ana", roleType: "mentor", userDocumentId: "u1" }),
    ).toEqual({
      type: "account-activated",
      title: "Cont activat",
      body: "Ana (Persoană resursă) și-a activat contul și a intrat în platformă.",
      link: "/dashboard/persoane-resursa/u1",
    });
  });

  it("account-activated: staff roles link to utilizatori filtered by name and role", () => {
    const editor = accountActivatedMessage({ nume: "Ion", roleType: "editor-fdsc", userDocumentId: "u2" });
    const admin = accountActivatedMessage({ nume: "Dan Pop & Co", roleType: "super-admin", userDocumentId: "u3" });
    expect(editor.body).toBe("Ion (Editor FDSC) și-a activat contul și a intrat în platformă.");
    expect(admin.body).toBe("Dan Pop & Co (Admin FDSC) și-a activat contul și a intrat în platformă.");
    expect(editor.link).toBe("/dashboard/utilizatori?search=Ion&role=editor-fdsc");
    expect(admin.link).toBe("/dashboard/utilizatori?search=Dan+Pop+%26+Co&role=super-admin");
  });

  it("member-joined", () => {
    expect(memberJoinedMessage({ nume: "Maria" })).toEqual({
      type: "member-joined",
      title: "Membru nou",
      body: "Maria a acceptat invitația și s-a alăturat organizației.",
      link: "/dashboard/utilizatori",
    });
  });

  it("admin-transfer", () => {
    expect(adminTransferMessage({ recipientEmail: "nou@ong.ro" })).toEqual({
      type: "admin-transfer",
      title: "Schimbare administrator",
      body: "FDSC a inițiat transferul rolului de administrator către nou@ong.ro.",
      link: "/dashboard/profil",
    });
  });

  it("meeting-created", () => {
    expect(meetingCreatedMessage({ author: "Elena", dataOra: NOV_5, subiect: "Plan" })).toEqual({
      type: "meeting-created",
      title: "Întâlnire nouă",
      body: "Elena a programat o întâlnire pe 5 nov. 2026, 10:00: „Plan”.",
      link: "/dashboard/persoane-resursa/intalniri",
    });
  });

  it("meeting-updated: moved and details", () => {
    expect(meetingChangeMessage("moved", { subiect: "Plan", dataOra: NOV_6 })).toEqual({
      type: "meeting-updated",
      title: "Întâlnire modificată",
      body: "Întâlnirea „Plan” a fost mutată pe 6 nov. 2026, 11:30.",
      link: "/dashboard/persoane-resursa/intalniri",
    });
    expect(meetingChangeMessage("updated", { subiect: "Plan", dataOra: NOV_6 })).toEqual({
      type: "meeting-updated",
      title: "Întâlnire modificată",
      body: "Detaliile întâlnirii „Plan” au fost actualizate.",
      link: "/dashboard/persoane-resursa/intalniri",
    });
  });

  it("meeting-cancelled", () => {
    expect(meetingChangeMessage("cancelled", { subiect: "Plan", dataOra: NOV_5 })).toEqual({
      type: "meeting-cancelled",
      title: "Întâlnire anulată",
      body: "Întâlnirea „Plan” din 5 nov. 2026 a fost anulată.",
      link: "/dashboard/persoane-resursa/intalniri",
    });
  });
});

describe("classifyMeetingChange", () => {
  it("cancelled when status becomes anulata from another status", () => {
    expect(
      classifyMeetingChange(
        { status: "programata", dataOra: NOV_5 },
        { status: "anulata", dataOra: NOV_6 },
      ),
    ).toBe("cancelled");
  });

  it("moved when dataOra changed, even as a different string for the same instant it is not", () => {
    expect(
      classifyMeetingChange(
        { status: "programata", dataOra: NOV_5 },
        { status: "programata", dataOra: NOV_6 },
      ),
    ).toBe("moved");
    expect(
      classifyMeetingChange(
        { status: "programata", dataOra: new Date(NOV_5) },
        { status: "programata", dataOra: NOV_5 },
      ),
    ).toBe("updated");
  });

  it("an already cancelled meeting is not cancelled again", () => {
    expect(
      classifyMeetingChange(
        { status: "anulata", dataOra: NOV_5 },
        { status: "anulata", dataOra: NOV_5 },
      ),
    ).toBe("updated");
  });
});

describe("notifyAccountActivated", () => {
  it("tells the other Admin FDSC, never the activated user", async () => {
    vi.mocked(fdscAdmins).mockResolvedValue([1, 2, 3]);
    await notifyAccountActivated(strapi, {
      id: 2, documentId: "u2", nume: "Dan", role: { type: "super-admin" },
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: [1, 3], type: "account-activated" }),
    );
  });

  it("notifies the ngo-admin of the member's ONGs", async () => {
    vi.mocked(ongAdmins).mockResolvedValue([9]);
    await notifyAccountActivated(strapi, {
      id: 5, documentId: "m1", nume: "Maria", role: { type: "ngo-member" }, ong: [{ id: 4 }],
    });
    expect(ongAdmins).toHaveBeenCalledWith(strapi, [4]);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ recipients: [9], type: "member-joined" }),
    );
  });

  it("ignores other roles and sends nothing without recipients", async () => {
    await notifyAccountActivated(strapi, {
      id: 5, documentId: "x", nume: "X", role: { type: "individual" },
    });
    vi.mocked(fdscAdmins).mockResolvedValue([5]);
    await notifyAccountActivated(strapi, {
      id: 5, documentId: "y", nume: "Y", role: { type: "super-admin" },
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("swallows a notify failure and logs it", async () => {
    vi.mocked(fdscAdmins).mockResolvedValue([1]);
    notify.mockRejectedValue(new Error("db"));
    await expect(
      notifyAccountActivated(strapi, {
        id: 2, documentId: "u2", nume: "Ana", role: { type: "mentor" },
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("meeting hooks", () => {
  beforeEach(() => {
    vi.mocked(ongAdmins).mockResolvedValue([9]);
  });

  it("created: notifies the ONG admin with the author", async () => {
    await notifyMeetingCreated(strapi, {
      ongDocumentId: "o1", author: "Elena", dataOra: NOV_5, subiect: "Plan",
    });
    expect(ongAdmins).toHaveBeenCalledWith(strapi, ["o1"]);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: [9],
        type: "meeting-created",
        body: "Elena a programat o întâlnire pe 5 nov. 2026, 10:00: „Plan”.",
      }),
    );
  });

  const update = (before: any, after: any) =>
    notifyMeetingUpdated(strapi, { ongDocumentId: "o1", before, after });

  it("cancelled vs moved vs updated", async () => {
    await update(
      { status: "programata", dataOra: NOV_5 },
      { status: "anulata", dataOra: NOV_5, subiect: "Plan" },
    );
    await update(
      { status: "programata", dataOra: NOV_5 },
      { status: "programata", dataOra: NOV_6, subiect: "Plan" },
    );
    await update(
      { status: "programata", dataOra: NOV_5 },
      { status: "programata", dataOra: NOV_5, subiect: "Plan" },
    );
    expect(notify.mock.calls.map(([arg]) => arg.type)).toEqual([
      "meeting-cancelled",
      "meeting-updated",
      "meeting-updated",
    ]);
    expect(notify.mock.calls[1][0].body).toContain("mutată pe 6 nov. 2026");
    expect(notify.mock.calls[2][0].body).toContain("au fost actualizate");
  });

  it("update: skips when the meeting has no ONG", async () => {
    await notifyMeetingUpdated(strapi, {
      ongDocumentId: undefined,
      before: { status: "programata", dataOra: NOV_5 },
      after: { status: "anulata", dataOra: NOV_5, subiect: "Plan" },
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("never throws when the lookup fails", async () => {
    vi.mocked(ongAdmins).mockRejectedValue(new Error("db"));
    await expect(
      notifyMeetingCreated(strapi, { ongDocumentId: "o1", author: "E", dataOra: NOV_5, subiect: "P" }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("mentor-assigned", () => {
  it("builders: exact copy with a program", () => {
    expect(
      mentorAssignedMessages({ ongName: "ONG Alfa", mentorName: "Ana", programName: "SCA 2026" }),
    ).toEqual({
      mentor: {
        type: "mentor-assigned",
        title: "Organizație nouă asignată",
        body: "Organizația ONG Alfa ți-a fost asignată în programul SCA 2026.",
        link: "/dashboard/programe",
      },
      admin: {
        type: "mentor-assigned",
        title: "Persoană resursă asignată",
        body: "Persoana resursă Ana a fost asignată organizației tale în programul SCA 2026.",
        link: "/dashboard/persoane-resursa",
      },
    });
  });

  it("builders: program clause dropped without a program", () => {
    const { mentor, admin } = mentorAssignedMessages({ ongName: "ONG Alfa", mentorName: "Ana" });
    expect(mentor.body).toBe("Organizația ONG Alfa ți-a fost asignată.");
    expect(admin.body).toBe("Persoana resursă Ana a fost asignată organizației tale.");
    expect(mentorAssignedMessages({ ongName: "A", mentorName: "B", programName: null }).mentor.body)
      .toBe("Organizația A ți-a fost asignată.");
  });

  it("only mentors not already assigned count as new", () => {
    const requested = [
      { documentId: "m1", id: 1 },
      { documentId: "m2", id: 2 },
    ];
    expect(newlyAssignedMentors([{ documentId: "m1" }], requested)).toEqual([requested[1]]);
    expect(newlyAssignedMentors(requested, requested)).toEqual([]);
    expect(newlyAssignedMentors([], requested)).toEqual(requested);
  });

  it("notifies each new mentor and the ONG admin once per assignment", async () => {
    vi.mocked(ongAdmins).mockResolvedValue([9]);
    await notifyMentorAssigned(strapi, {
      ong: { documentId: "o1", name: "ONG Alfa" },
      programName: "SCA 2026",
      mentors: [{ id: 1, nume: "Ana" }, { id: 2, nume: "Bob" }],
    });
    expect(ongAdmins).toHaveBeenCalledWith(strapi, ["o1"]);
    expect(notify.mock.calls.map(([arg]) => [arg.recipients, arg.title])).toEqual([
      [[1], "Organizație nouă asignată"],
      [[9], "Persoană resursă asignată"],
      [[2], "Organizație nouă asignată"],
      [[9], "Persoană resursă asignată"],
    ]);
    expect(notify.mock.calls[3][0].body).toContain("Persoana resursă Bob");
  });

  it("sends nothing without new mentors; the mentor is told even without an ONG admin", async () => {
    await notifyMentorAssigned(strapi, { ong: { documentId: "o1", name: "A" }, mentors: [] });
    expect(notify).not.toHaveBeenCalled();
    vi.mocked(ongAdmins).mockResolvedValue([]);
    await notifyMentorAssigned(strapi, {
      ong: { documentId: "o1", name: "A" }, mentors: [{ id: 1, nume: "Ana" }],
    });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].recipients).toEqual([1]);
  });

  it("never throws when notify fails", async () => {
    vi.mocked(ongAdmins).mockResolvedValue([9]);
    notify.mockRejectedValue(new Error("db"));
    await expect(
      notifyMentorAssigned(strapi, {
        ong: { documentId: "o1", name: "A" }, mentors: [{ id: 1, nume: "Ana" }],
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("ong-added-to-program", () => {
  it("builder: exact copy", () => {
    expect(ongAddedToProgramMessage({ programName: "SCA 2026" })).toEqual({
      type: "ong-added-to-program",
      title: "Program nou",
      body: "Organizația ta a fost adăugată în programul SCA 2026.",
      link: "/dashboard/programe",
    });
  });

  it("sends to the admins of that ONG", async () => {
    vi.mocked(ongAdmins).mockResolvedValue([4, 5]);
    await notifyOngAddedToProgram(strapi, { ong: { documentId: "o1" }, programName: "SCA 2026" });
    expect(ongAdmins).toHaveBeenCalledWith(strapi, ["o1"]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipients: [4, 5],
      type: "ong-added-to-program",
      title: "Program nou",
    });
  });

  it("sends nothing without an active admin", async () => {
    vi.mocked(ongAdmins).mockResolvedValue([]);
    await notifyOngAddedToProgram(strapi, { ong: { documentId: "o1" }, programName: "P" });
    expect(notify).not.toHaveBeenCalled();
  });

  it("never throws when notify fails", async () => {
    vi.mocked(ongAdmins).mockResolvedValue([4]);
    notify.mockRejectedValue(new Error("db"));
    await expect(
      notifyOngAddedToProgram(strapi, { ong: { documentId: "o1" }, programName: "P" }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("ong-registered", () => {
  it("builder: exact copy and link", () => {
    expect(ongRegisteredMessage({ ongName: "Asociația X", ongDocumentId: "o1" })).toEqual({
      type: "ong-registered",
      title: "Organizație nouă",
      body: "Organizația Asociația X și-a creat cont în platformă.",
      link: "/dashboard/organizatii/o1",
    });
  });

  it("sends to the FDSC admins", async () => {
    vi.mocked(fdscAdmins).mockResolvedValue([1, 2]);
    await notifyOngRegistered(strapi, { ong: { documentId: "o1", name: "Asociația X" } });
    expect(fdscAdmins).toHaveBeenCalledWith(strapi);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipients: [1, 2],
      type: "ong-registered",
      title: "Organizație nouă",
    });
  });

  it("never throws when notify fails", async () => {
    vi.mocked(fdscAdmins).mockResolvedValue([1]);
    notify.mockRejectedValue(new Error("db"));
    await expect(
      notifyOngRegistered(strapi, { ong: { documentId: "o1", name: "A" } }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
