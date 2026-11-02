/**
 * Pure message builders for the event-driven notifications: each returns what
 * `notify` needs apart from the recipients. Copy is Romanian and exact; dates
 * come from `./format` (Europe/Bucharest).
 */
import { formatRoDate, formatRoTime } from "./format";
import type { NotificationType } from "./types";

export type NotificationMessage = {
  type: NotificationType;
  title: string;
  body: string;
  link: string | ((recipientId: number) => string);
};

const ACTIVATED_ROLE_LABELS: Record<string, string> = {
  mentor: "Persoană resursă",
  "editor-fdsc": "Editor FDSC",
  "super-admin": "Admin FDSC",
};

/** Roles whose activation is announced to the Admin FDSC. */
export const isActivationAnnounced = (roleType: string | undefined): boolean =>
  Boolean(roleType && roleType in ACTIVATED_ROLE_LABELS);

export function accountActivatedMessage(args: {
  nume: string;
  roleType: string;
  userDocumentId: string;
}): NotificationMessage {
  const label = ACTIVATED_ROLE_LABELS[args.roleType];
  return {
    type: "account-activated",
    title: "Cont activat",
    body: `${args.nume} (${label}) și-a activat contul și a intrat în platformă.`,
    link:
      args.roleType === "mentor"
        ? `/dashboard/persoane-resursa/${args.userDocumentId}`
        : "/dashboard/utilizatori",
  };
}

export const memberJoinedMessage = (args: {
  nume: string;
}): NotificationMessage => ({
  type: "member-joined",
  title: "Membru nou",
  body: `${args.nume} a acceptat invitația și s-a alăturat organizației.`,
  link: "/dashboard/utilizatori",
});

export const adminTransferMessage = (args: {
  recipientEmail: string;
}): NotificationMessage => ({
  type: "admin-transfer",
  title: "Schimbare administrator",
  body: `FDSC a inițiat transferul rolului de administrator către ${args.recipientEmail}.`,
  link: "/dashboard/profil",
});

/**
 * The ONG route of that round's detail page, which lists each member's
 * evaluation (`app/dashboard/ong/evaluari/[documentId]`).
 */
export const evaluationCompletedMessage = (args: {
  nume: string;
  reportName: string;
  reportDocumentId: string;
}): NotificationMessage => ({
  type: "evaluation-completed",
  title: "Evaluare finalizată",
  body: `${args.nume} a finalizat evaluarea „${args.reportName}”.`,
  link: `/dashboard/evaluari/${args.reportDocumentId}`,
});

const MEETINGS_LINK = "/dashboard/persoane-resursa/intalniri";

export const meetingCreatedMessage = (args: {
  author: string;
  dataOra: Date | string;
  subiect: string;
}): NotificationMessage => ({
  type: "meeting-created",
  title: "Întâlnire nouă",
  body: `${args.author} a programat o întâlnire pe ${formatRoDate(args.dataOra)}, ${formatRoTime(args.dataOra)}: „${args.subiect}”.`,
  link: MEETINGS_LINK,
});

export type MeetingChange = "cancelled" | "moved" | "updated";

type MeetingState = { status?: string | null; dataOra: Date | string };

/**
 * Cancelled = the status becomes `anulata` from another status; moved = the
 * date or time changed; anything else is a detail update.
 */
export function classifyMeetingChange(
  before: MeetingState,
  after: MeetingState,
): MeetingChange {
  if (after.status === "anulata" && before.status !== "anulata") {
    return "cancelled";
  }
  if (new Date(before.dataOra).getTime() !== new Date(after.dataOra).getTime()) {
    return "moved";
  }
  return "updated";
}

export function meetingChangeMessage(
  change: MeetingChange,
  args: { subiect: string; dataOra: Date | string },
): NotificationMessage {
  if (change === "cancelled") {
    return {
      type: "meeting-cancelled",
      title: "Întâlnire anulată",
      body: `Întâlnirea „${args.subiect}” din ${formatRoDate(args.dataOra)} a fost anulată.`,
      link: MEETINGS_LINK,
    };
  }
  return {
    type: "meeting-updated",
    title: "Întâlnire modificată",
    body:
      change === "moved"
        ? `Întâlnirea „${args.subiect}” a fost mutată pe ${formatRoDate(args.dataOra)}, ${formatRoTime(args.dataOra)}.`
        : `Detaliile întâlnirii „${args.subiect}” au fost actualizate.`,
    link: MEETINGS_LINK,
  };
}

/**
 * A mentor was assigned to an ONG: one message for the mentor, one for the
 * ONG's admin. The program clause is dropped when the assignment has none.
 */
export function mentorAssignedMessages(args: {
  ongName: string;
  mentorName: string;
  programName?: string | null;
}): { mentor: NotificationMessage; admin: NotificationMessage } {
  const inProgram = args.programName ? ` în programul ${args.programName}` : "";
  return {
    mentor: {
      type: "mentor-assigned",
      title: "Organizație nouă asignată",
      body: `Organizația ${args.ongName} ți-a fost asignată${inProgram}.`,
      link: "/dashboard/programe",
    },
    admin: {
      type: "mentor-assigned",
      title: "Persoană resursă asignată",
      body: `Persoana resursă ${args.mentorName} a fost asignată organizației tale${inProgram}.`,
      link: "/dashboard/persoane-resursa",
    },
  };
}

/** FDSC added the ONG to a program; the ONG's admin is told. */
export const ongAddedToProgramMessage = (args: {
  programName: string;
}): NotificationMessage => ({
  type: "ong-added-to-program",
  title: "Program nou",
  body: `Organizația ta a fost adăugată în programul ${args.programName}.`,
  link: "/dashboard/programe",
});

/** An organization self-registered; Admin FDSC is told. */
export const ongRegisteredMessage = (args: {
  ongName: string;
  ongDocumentId: string;
}): NotificationMessage => ({
  type: "ong-registered",
  title: "Organizație nouă",
  body: `Organizația ${args.ongName} și-a creat cont în platformă.`,
  link: `/dashboard/organizatii/${args.ongDocumentId}`,
});

/** A phase's end date passed. Staff land on the program, everyone else on the list. */
export const phaseEndedMessage = (args: {
  phaseTitle: string;
  programName: string;
  programDocumentId: string;
  staffIds: ReadonlySet<number>;
}): NotificationMessage => ({
  type: "phase-ended",
  title: "Fază încheiată",
  body: `Faza „${args.phaseTitle}” din programul ${args.programName} s-a încheiat.`,
  link: (recipientId) =>
    args.staffIds.has(recipientId)
      ? `/dashboard/programe/${args.programDocumentId}`
      : "/dashboard/programe",
});
