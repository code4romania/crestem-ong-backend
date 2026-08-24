export interface MentorMeetingRef {
  documentId: string;
  ongName: string;
  subiect: string;
  dataOra: string;
}

export interface MentorDashboard {
  meetingsHeld: number;
  meetingsTotal: number;
  mentoredOngCount: number;
  reportsSent: number;
  reportsMissing: number;
  activeProgramCount: number;
  missingReports: MentorMeetingRef[];
  nextMeeting: (MentorMeetingRef & { format: string }) | null;
  currentPrograms: {
    documentId: string;
    name: string;
    startDate: string;
    endDate: string;
    programStatus: string;
  }[];
}

/** `ngo-mentor.program` and `.ong` are list relations even though a row always
 * describes a single pair — normalize before reading the first entry. */
const firstOf = (value: any): any =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

/**
 * The calendar day a meeting falls on in Bucharest, to compare against
 * `todayInBucharest()`. Slicing the stored UTC string instead would read a
 * 22:00 UTC meeting as the previous day and drop it as already past.
 */
const dayOf = (dataOra: unknown) => {
  const date = new Date(`${dataOra}`);
  if (Number.isNaN(date.getTime())) {
    return `${dataOra}`.slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(date);
};

const meetingRef = (meeting: any): MentorMeetingRef => ({
  documentId: meeting.documentId,
  ongName: meeting.ong?.name ?? "",
  subiect: meeting.subiect,
  dataOra: meeting.dataOra,
});

/** The alert only has room for a handful of rows; the counter stays complete. */
const MISSING_REPORT_LIMIT = 5;

export async function buildMentorDashboard(
  strapi: any,
  mentorDocumentId: string,
  today: string,
): Promise<MentorDashboard> {
  const [meetings, programs, ngoMentors] = await Promise.all([
    strapi.documents("api::meeting.meeting").findMany({
      filters: { mentor: { documentId: mentorDocumentId } },
      populate: { ong: true, report: true },
    }),
    strapi.documents("api::program.program").findMany({
      filters: { mentors: { documentId: mentorDocumentId } },
    }),
    strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
      filters: { mentors: { documentId: mentorDocumentId } },
      populate: { ong: true, program: true },
    }),
  ]);

  // A cancelled meeting never happened, so it counts towards nothing — not the
  // total, not a missing report, not the next meeting.
  const live = ((meetings ?? []) as any[]).filter(
    (meeting) => meeting.status !== "anulata",
  );
  const held = live.filter((meeting) => meeting.status === "efectuata");
  const awaitingReport = held
    .filter((meeting) => !meeting.report)
    .sort((a, b) => `${b.dataOra}`.localeCompare(`${a.dataOra}`));

  const upcoming = live
    .filter(
      (meeting) =>
        meeting.status === "programata" && dayOf(meeting.dataOra) >= today,
    )
    .sort((a, b) => `${a.dataOra}`.localeCompare(`${b.dataOra}`));
  const next = upcoming[0] ?? null;

  const programList = (programs ?? []) as any[];
  const activePrograms = programList
    .filter((program) => program.programStatus === "Active")
    .sort((a, b) => `${b.startDate}`.localeCompare(`${a.startDate}`));
  const activeProgramIds = new Set(
    activePrograms.map((program) => program.documentId),
  );

  const mentoredOngIds = new Set<string>();
  for (const row of (ngoMentors ?? []) as any[]) {
    const programDocumentId = firstOf(row.program)?.documentId;
    const ongDocumentId = firstOf(row.ong)?.documentId;
    if (ongDocumentId && activeProgramIds.has(programDocumentId)) {
      mentoredOngIds.add(ongDocumentId);
    }
  }

  return {
    meetingsHeld: held.length,
    meetingsTotal: live.length,
    mentoredOngCount: mentoredOngIds.size,
    reportsSent: held.length - awaitingReport.length,
    reportsMissing: awaitingReport.length,
    activeProgramCount: activePrograms.length,
    missingReports: awaitingReport.slice(0, MISSING_REPORT_LIMIT).map(meetingRef),
    nextMeeting: next ? { ...meetingRef(next), format: next.format } : null,
    currentPrograms: activePrograms.map((program) => ({
      documentId: program.documentId,
      name: program.name,
      startDate: program.startDate,
      endDate: program.endDate,
      programStatus: program.programStatus,
    })),
  };
}
