/**
 * Event hooks: resolve the recipients, build the message, notify. Each one
 * runs after the main write succeeded and never throws — a notification
 * failure is logged and the action's response is left alone.
 */
import { fdscAdmins, ongAdmins } from "./recipients";
import {
  accountActivatedMessage,
  classifyMeetingChange,
  evaluationCompletedMessage,
  isActivationAnnounced,
  meetingChangeMessage,
  meetingCreatedMessage,
  memberJoinedMessage,
  mentorAssignedMessages,
  ongAddedToProgramMessage,
  ongRegisteredMessage,
  type NotificationMessage,
} from "./messages";

const NOTIFICATION_SERVICE = "api::notification.notification";

async function deliver(
  strapi: any,
  recipients: number[],
  message: NotificationMessage,
): Promise<void> {
  if (recipients.length === 0) return;
  await strapi.service(NOTIFICATION_SERVICE).notify({ recipients, ...message });
}

/** Recipient lookup and notify under one catch, so no step can throw out. */
async function safely(
  strapi: any,
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    strapi.log.error(`notification "${label}" failed: ${String(error)}`);
  }
}

type ActivatedUser = {
  id: number;
  documentId: string;
  nume: string;
  role?: { type?: string } | null;
  ong?: Array<{ id: number }> | null;
};

/** `activateAccount` succeeded for `user` (loaded with `role` and `ong`). */
export const notifyAccountActivated = (strapi: any, user: ActivatedUser) =>
  safely(strapi, "account-activated", async () => {
    const roleType = user.role?.type;
    if (roleType === "ngo-member") {
      const ongIds = (user.ong ?? []).map((ong) => ong.id).filter(Boolean);
      if (ongIds.length === 0) return;
      await deliver(
        strapi,
        await ongAdmins(strapi, ongIds),
        memberJoinedMessage({ nume: user.nume }),
      );
      return;
    }
    if (!roleType || !isActivationAnnounced(roleType)) return;
    const admins = (await fdscAdmins(strapi)).filter((id) => id !== user.id);
    await deliver(
      strapi,
      admins,
      accountActivatedMessage({
        nume: user.nume,
        roleType,
        userDocumentId: user.documentId,
      }),
    );
  });

/**
 * An evaluation was finished. The ONG's admin hears about it unless they are
 * the one who finished it.
 */
export const notifyEvaluationCompleted = (
  strapi: any,
  args: {
    evaluatorId: number;
    evaluatorName: string;
    report: {
      documentId: string;
      name?: string;
      ong?: { documentId: string } | null;
    };
  },
) =>
  safely(strapi, "evaluation-completed", async () => {
    const ong = args.report.ong;
    if (!ong) return;
    const admins = (await ongAdmins(strapi, [ong.documentId])).filter(
      (id) => id !== args.evaluatorId,
    );
    await deliver(
      strapi,
      admins,
      evaluationCompletedMessage({
        nume: args.evaluatorName,
        reportName: args.report.name ?? "",
        reportDocumentId: args.report.documentId,
      }),
    );
  });

export const notifyMeetingCreated = (
  strapi: any,
  args: {
    ongDocumentId: string;
    author: string;
    dataOra: Date | string;
    subiect: string;
  },
) =>
  safely(strapi, "meeting-created", async () =>
    deliver(
      strapi,
      await ongAdmins(strapi, [args.ongDocumentId]),
      meetingCreatedMessage(args),
    ),
  );

/** Cancelled when the status became `anulata`, moved when `dataOra` changed, else updated. */
export const notifyMeetingUpdated = (
  strapi: any,
  args: {
    ongDocumentId?: string;
    before: { status?: string | null; dataOra: Date | string };
    after: { status?: string | null; dataOra: Date | string; subiect: string };
  },
) =>
  safely(strapi, "meeting-updated", async () => {
    if (!args.ongDocumentId) return;
    await deliver(
      strapi,
      await ongAdmins(strapi, [args.ongDocumentId]),
      meetingChangeMessage(classifyMeetingChange(args.before, args.after), {
        subiect: args.after.subiect,
        dataOra: args.after.dataOra,
      }),
    );
  });

/** Mentors in `requested` that the assignment did not already hold (by documentId). */
export const newlyAssignedMentors = <T extends { documentId: string }>(
  alreadyAssigned: Array<{ documentId: string }>,
  requested: T[],
): T[] => {
  const held = new Set(alreadyAssigned.map((mentor) => mentor.documentId));
  return requested.filter((mentor) => !held.has(mentor.documentId));
};

/**
 * FDSC assigned `mentors` (only the newly created assignments) to an ONG:
 * each mentor hears about the ONG, the ONG's admin about each mentor.
 */
export const notifyMentorAssigned = (
  strapi: any,
  args: {
    ong: { documentId: string; name: string };
    programName?: string | null;
    mentors: Array<{ id: number; nume: string }>;
  },
) =>
  safely(strapi, "mentor-assigned", async () => {
    if (args.mentors.length === 0) return;
    const admins = await ongAdmins(strapi, [args.ong.documentId]);
    for (const mentor of args.mentors) {
      const messages = mentorAssignedMessages({
        ongName: args.ong.name,
        mentorName: mentor.nume,
        programName: args.programName,
      });
      await deliver(strapi, [mentor.id], messages.mentor);
      await deliver(strapi, admins, messages.admin);
    }
  });

/** FDSC added an ONG (newly, not already enrolled) to a program: its admins hear about it. */
export const notifyOngAddedToProgram = (
  strapi: any,
  args: {
    ong: { documentId: string };
    programName: string;
  },
) =>
  safely(strapi, "ong-added-to-program", async () =>
    deliver(
      strapi,
      await ongAdmins(strapi, [args.ong.documentId]),
      ongAddedToProgramMessage({ programName: args.programName }),
    ),
  );

/** An organization self-registered (public sign-up): Admin FDSC hears about it. */
export const notifyOngRegistered = (
  strapi: any,
  args: { ong: { documentId: string; name: string } },
) =>
  safely(strapi, "ong-registered", async () =>
    deliver(
      strapi,
      await fdscAdmins(strapi),
      ongRegisteredMessage({
        ongName: args.ong.name,
        ongDocumentId: args.ong.documentId,
      }),
    ),
  );
