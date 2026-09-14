import { describe, expect, it } from "vitest";
import { buildMentorDashboard } from "./mentor";

const TODAY = "2026-06-15";

const mockStrapi = ({
  meetings = [] as any[],
  programs = [] as any[],
  ngoMentors = [] as any[],
} = {}) => ({
  documents: (uid: string) => ({
    findMany: async () => {
      if (uid === "api::meeting.meeting") return meetings;
      if (uid === "api::program.program") return programs;
      if (uid === "api::ngo-mentor.ngo-mentor") return ngoMentors;
      return [];
    },
  }),
});

const meeting = (overrides: any = {}) => ({
  documentId: "mt1",
  dataOra: "2026-06-01T10:00:00.000Z",
  status: "efectuata",
  format: "online",
  subiect: "Sesiune de planificare strategică",
  ong: { documentId: "o1", name: "CivicHub România" },
  report: null,
  ...overrides,
});

describe("buildMentorDashboard — meeting counters", () => {
  it("counts held meetings against every meeting that was not cancelled", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", status: "efectuata" }),
        meeting({ documentId: "m2", status: "efectuata" }),
        meeting({ documentId: "m3", status: "programata", dataOra: "2026-07-01T10:00:00.000Z" }),
        meeting({ documentId: "m4", status: "anulata" }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.meetingsHeld).toBe(2);
    expect(result.meetingsTotal).toBe(3);
  });

  it("splits held meetings into ones with a report and ones without", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", report: { url: "/uploads/a.pdf" } }),
        meeting({ documentId: "m2", report: null }),
        meeting({ documentId: "m3", report: null }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.reportsSent).toBe(1);
    expect(result.reportsMissing).toBe(2);
  });

  it("does not count a scheduled meeting as a missing report", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", status: "programata", dataOra: "2026-07-01T10:00:00.000Z" }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.reportsMissing).toBe(0);
    expect(result.missingReports).toEqual([]);
  });

  it("lists the meetings awaiting a report, newest first", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({
          documentId: "m1",
          dataOra: "2026-05-03T09:00:00.000Z",
          subiect: "Sesiune de planificare strategică",
        }),
        meeting({
          documentId: "m2",
          dataOra: "2026-06-12T09:00:00.000Z",
          subiect: "Analiza nevoilor organizației",
        }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.missingReports).toEqual([
      {
        documentId: "m2",
        ongName: "CivicHub România",
        subiect: "Analiza nevoilor organizației",
        dataOra: "2026-06-12T09:00:00.000Z",
      },
      {
        documentId: "m1",
        ongName: "CivicHub România",
        subiect: "Sesiune de planificare strategică",
        dataOra: "2026-05-03T09:00:00.000Z",
      },
    ]);
  });

  it("caps the missing-report list at five while the counter stays complete", async () => {
    const strapi = mockStrapi({
      meetings: Array.from({ length: 7 }, (_, index) =>
        meeting({ documentId: `m${index}`, dataOra: `2026-06-0${index + 1}T09:00:00.000Z` }),
      ),
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.reportsMissing).toBe(7);
    expect(result.missingReports).toHaveLength(5);
  });
});

describe("buildMentorDashboard — next meeting", () => {
  it("picks the soonest scheduled meeting", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", status: "programata", dataOra: "2026-08-01T10:00:00.000Z" }),
        meeting({
          documentId: "m2",
          status: "programata",
          dataOra: "2026-06-24T10:00:00.000Z",
          subiect: "Sesiune de feedback — evaluare organizațională",
          ong: { documentId: "o2", name: "EcoSens România" },
        }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.nextMeeting).toEqual({
      documentId: "m2",
      ongName: "EcoSens România",
      subiect: "Sesiune de feedback — evaluare organizațională",
      dataOra: "2026-06-24T10:00:00.000Z",
      format: "online",
    });
  });

  it("keeps a meeting scheduled earlier today rather than dropping it mid-afternoon", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", status: "programata", dataOra: `${TODAY}T08:00:00.000Z` }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.nextMeeting?.documentId).toBe("m1");
  });

  it("keeps a late-evening meeting that is already tomorrow in Bucharest", async () => {
    // 22:00 UTC on the 15th is 01:00 on the 16th in Bucharest. Slicing the raw
    // UTC string would read it as the 15th and drop it as past.
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", status: "programata", dataOra: "2026-06-15T22:00:00.000Z" }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", "2026-06-16");

    expect(result.nextMeeting?.documentId).toBe("m1");
  });

  it("ignores meetings already in the past", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", status: "programata", dataOra: "2026-06-01T10:00:00.000Z" }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.nextMeeting).toBeNull();
  });

  it("ignores a cancelled meeting even when it is the soonest", async () => {
    const strapi = mockStrapi({
      meetings: [
        meeting({ documentId: "m1", status: "anulata", dataOra: "2026-06-20T10:00:00.000Z" }),
        meeting({ documentId: "m2", status: "programata", dataOra: "2026-07-20T10:00:00.000Z" }),
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.nextMeeting?.documentId).toBe("m2");
  });
});

describe("buildMentorDashboard — programs and organizations", () => {
  it("lists only the active programs, newest first", async () => {
    const strapi = mockStrapi({
      programs: [
        {
          documentId: "p1",
          name: "Impact Lab",
          startDate: "2024-01-15",
          endDate: "2025-12-31",
          programStatus: "Finished",
        },
        {
          documentId: "p2",
          name: "În stare de bine",
          startDate: "2025-01-15",
          endDate: "2026-12-31",
          programStatus: "Active",
        },
        {
          documentId: "p3",
          name: "Social Change Accelerator",
          startDate: "2026-01-15",
          endDate: "2027-12-31",
          programStatus: "Active",
        },
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.activeProgramCount).toBe(2);
    expect(result.currentPrograms.map((program) => program.documentId)).toEqual(["p3", "p2"]);
  });

  it("counts an organization once even when it is mentored across two active programs", async () => {
    const strapi = mockStrapi({
      programs: [
        { documentId: "p1", name: "A", startDate: "2025-01-01", endDate: "2026-12-31", programStatus: "Active" },
        { documentId: "p2", name: "B", startDate: "2026-01-01", endDate: "2027-12-31", programStatus: "Active" },
      ],
      ngoMentors: [
        { documentId: "nm1", program: [{ documentId: "p1" }], ong: [{ documentId: "o1" }] },
        { documentId: "nm2", program: [{ documentId: "p2" }], ong: [{ documentId: "o1" }] },
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.mentoredOngCount).toBe(1);
  });

  it("ignores assignments belonging to a finished program", async () => {
    const strapi = mockStrapi({
      programs: [
        { documentId: "p1", name: "A", startDate: "2024-01-01", endDate: "2025-12-31", programStatus: "Finished" },
        { documentId: "p2", name: "B", startDate: "2026-01-01", endDate: "2027-12-31", programStatus: "Active" },
      ],
      ngoMentors: [
        { documentId: "nm1", program: [{ documentId: "p1" }], ong: [{ documentId: "o1" }] },
        { documentId: "nm2", program: [{ documentId: "p2" }], ong: [{ documentId: "o2" }] },
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.mentoredOngCount).toBe(1);
  });

  it("lists the ong+program pairs behind the mentored-ong count", async () => {
    const strapi = mockStrapi({
      programs: [
        { documentId: "p1", name: "Impact Lab", startDate: "2025-01-01", endDate: "2026-12-31", programStatus: "Active" },
      ],
      ngoMentors: [
        {
          documentId: "nm1",
          program: [{ documentId: "p1", name: "Impact Lab" }],
          ong: [{ documentId: "o1", name: "CivicHub România" }],
        },
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.mentoredOngs).toEqual([
      {
        ong: { documentId: "o1", name: "CivicHub România" },
        program: { documentId: "p1", name: "Impact Lab" },
      },
    ]);
  });

  it("excludes ong+program pairs belonging to a finished program from the list", async () => {
    const strapi = mockStrapi({
      programs: [
        { documentId: "p1", name: "A", startDate: "2024-01-01", endDate: "2025-12-31", programStatus: "Finished" },
      ],
      ngoMentors: [
        {
          documentId: "nm1",
          program: [{ documentId: "p1", name: "A" }],
          ong: [{ documentId: "o1", name: "Org" }],
        },
      ],
    });

    const result = await buildMentorDashboard(strapi, "me", TODAY);

    expect(result.mentoredOngs).toEqual([]);
  });
});

describe("buildMentorDashboard — empty account", () => {
  it("returns zeroes, an empty list and no next meeting", async () => {
    const result = await buildMentorDashboard(mockStrapi(), "me", TODAY);

    expect(result).toEqual({
      meetingsHeld: 0,
      meetingsTotal: 0,
      mentoredOngCount: 0,
      reportsSent: 0,
      reportsMissing: 0,
      activeProgramCount: 0,
      missingReports: [],
      nextMeeting: null,
      currentPrograms: [],
      mentoredOngs: [],
    });
  });
});
