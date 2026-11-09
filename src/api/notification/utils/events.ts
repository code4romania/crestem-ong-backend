/**
 * Event hooks: resolve the recipients, build the message, notify. Each one
 * runs after the main write succeeded and never throws — a notification
 * failure is logged and the action's response is left alone.
 */
import { activeAmong, fdscAdmins, ongAdmins } from "./recipients";
import { markReadByLink } from "./queries";
import { toDateString } from "../../../utils/date";
import {
  accountActivatedMessage,
  classifyMeetingChange,
  conversationLink,
  isActivationAnnounced,
  meetingChangeMessage,
  meetingCreatedMessage,
  memberJoinedMessage,
  messageReceivedMessage,
  mentorAssignedMessages,
  ongAddedToProgramMessage,
  ongRegisteredMessage,
  phaseDatesChangedMessage,
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

/**
 * Whether the recipient had seen every message of the conversation before the
 * one just sent: no earlier message, or their last read is at or after it.
 * Only then does a new message notify them — while the conversation is still
 * unread for them, one notification already says so, and no second one is sent.
 */
export const recipientCaughtUp = (
  lastMessageAt: string | Date | null | undefined,
  recipientLastReadAt: string | Date | null | undefined,
): boolean =>
  !lastMessageAt ||
  (Boolean(recipientLastReadAt) &&
    new Date(recipientLastReadAt as string | Date) >= new Date(lastMessageAt));

type ConversationState = {
  documentId: string;
  /** The values read before the new message updated them. */
  lastMessageAt?: string | null;
  ongLastReadAt?: string | null;
  mentorLastReadAt?: string | null;
  ong?: { documentId: string } | null;
  mentor?: { id: number } | null;
};

/**
 * A message was sent in `conversation` by the `recipientSide`'s counterpart.
 * The ONG side is its admin (only the admin talks to the mentor). Nothing is
 * sent while the conversation is already unread for the recipient.
 */
export const notifyMessageReceived = (
  strapi: any,
  args: {
    conversation: ConversationState;
    recipientSide: "ong" | "mentor";
    senderName: string;
    content: string;
  },
) =>
  safely(strapi, "message-received", async () => {
    const { conversation, recipientSide } = args;
    const lastReadAt =
      recipientSide === "ong"
        ? conversation.ongLastReadAt
        : conversation.mentorLastReadAt;
    if (!recipientCaughtUp(conversation.lastMessageAt, lastReadAt)) return;

    let recipients: number[] = [];
    if (recipientSide === "ong") {
      if (!conversation.ong?.documentId) return;
      recipients = await ongAdmins(strapi, [conversation.ong.documentId]);
    } else {
      if (!conversation.mentor?.id) return;
      recipients = await activeAmong(strapi, [conversation.mentor.id]);
    }

    await deliver(
      strapi,
      recipients,
      messageReceivedMessage({
        senderName: args.senderName,
        content: args.content,
        recipientSide,
        conversationDocumentId: conversation.documentId,
      }),
    );
  });

/** `userId` opened the conversation: its message notifications are read. */
export const markConversationNotificationsRead = (
  strapi: any,
  args: {
    userId: number;
    side: "ong" | "mentor";
    conversationDocumentId: string;
  },
) =>
  safely(strapi, "message-received:mark-read", async () => {
    await markReadByLink(
      strapi,
      args.userId,
      "message-received",
      conversationLink(args.side, args.conversationDocumentId),
    );
  });

type PhaseDates = {
  documentId?: string;
  title: string;
  startDate: unknown;
  endDate: unknown;
};

export type ChangedPhase = { title: string; startDate: string; endDate: string };

/**
 * The existing phases whose start or end date the FDSC edit changed, with
 * their new values. Added or removed phases and title-only edits are not
 * date changes. A phase still ended after the edit (new end before `today`)
 * is left out; one moved back into the future is a change like any other.
 */
export const phasesWithChangedDates = (
  before: PhaseDates[],
  after: PhaseDates[],
  today: string,
): ChangedPhase[] => {
  const byId = new Map(
    before
      .filter((phase) => phase.documentId)
      .map((phase) => [phase.documentId as string, phase]),
  );
  const changed: ChangedPhase[] = [];
  for (const phase of after) {
    const previous = phase.documentId ? byId.get(phase.documentId) : undefined;
    if (!previous) continue;
    const startDate = toDateString(phase.startDate);
    const endDate = toDateString(phase.endDate);
    const moved =
      startDate !== toDateString(previous.startDate) ||
      endDate !== toDateString(previous.endDate);
    if (moved && endDate >= today) {
      changed.push({ title: phase.title, startDate, endDate });
    }
  }
  return changed;
};

/**
 * FDSC staff changed the dates of `phases` in a program: the admins of the
 * program's ONGs get one notification per phase.
 */
export const notifyPhaseDatesChanged = (
  strapi: any,
  args: { programDocumentId: string; phases: ChangedPhase[] },
) =>
  safely(strapi, "phase-dates-changed", async () => {
    if (args.phases.length === 0) return;
    const program = await strapi.documents("api::program.program").findOne({
      documentId: args.programDocumentId,
      fields: ["name"],
      populate: { ongs: { fields: ["id"] } },
    });
    if (!program) return;
    const admins = await ongAdmins(
      strapi,
      (program.ongs ?? []).map((ong: { id: number }) => ong.id),
    );
    for (const phase of args.phases) {
      await deliver(
        strapi,
        admins,
        phaseDatesChangedMessage({
          phaseTitle: phase.title,
          programName: program.name,
          startDate: phase.startDate,
          endDate: phase.endDate,
        }),
      );
    }
  });
