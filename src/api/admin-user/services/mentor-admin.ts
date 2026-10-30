import crypto from "crypto";
import { buildAnonymizedUserData } from "../../../utils/anonymize";
import { deleteUploadedFile } from "../../../utils/media";
import {
  buildEmailChangeLink,
  signAdminEmailChangeToken,
} from "../../auth/utils/auth";
import type { EmailService } from "../../email/services/email";
import type { RefreshTokenService } from "../../refresh-token/services/refresh-token";

const USER_UID = "plugin::users-permissions.user";

/** Content types that reference a mentor, with the relation field to match on. */
const MENTOR_HISTORY_RELATIONS: Array<[uid: string, field: string]> = [
  ["api::ngo-mentor.ngo-mentor", "mentors"],
  ["api::program.program", "mentors"],
  ["api::conversation.conversation", "mentor"],
  ["api::message.message", "sender"],
  ["api::meeting.meeting", "mentor"],
];

export type MentorAdminError = { error: string; status: 400 | 404 };

/**
 * Loads the account an FDSC admin action targets and checks it is a mentor.
 * `avatar` is populated because the delete action needs the file to purge it.
 */
export async function loadMentorTarget(
  strapi: any,
  documentId: string,
): Promise<any | MentorAdminError> {
  const user = await strapi.db.query(USER_UID).findOne({
    where: { documentId },
    populate: ["role", "avatar"],
  });

  if (!user) {
    return { error: "Utilizatorul nu a fost găsit", status: 404 };
  }

  if (user.role?.type !== "mentor") {
    return {
      error: "Acțiunea este disponibilă doar pentru persoane resursă.",
      status: 400,
    };
  }

  return user;
}

function isError(value: any): value is MentorAdminError {
  return typeof value?.error === "string" && typeof value?.status === "number";
}

export async function resendMentorInvitation(
  strapi: any,
  documentId: string,
): Promise<{ emailSent: boolean } | MentorAdminError> {
  const user = await loadMentorTarget(strapi, documentId);
  if (isError(user)) return user;

  try {
    return await strapi.service("api::auth.auth").resendMentorInvite(user.id);
  } catch (error) {
    // The only expected failure is "Contul este deja activat".
    return {
      error: error instanceof Error ? error.message : "A apărut o eroare necunoscută",
      status: 400,
    };
  }
}

/**
 * FDSC admin changes a mentor's address.
 *
 * A pending account has never signed in, so the address is swapped outright and
 * the invitation re-sent (which rotates the activation token, killing the old
 * link). An active account keeps its address until the person opens a 7-day
 * link mailed to the NEW address; `confirmEmailChange` then applies it and
 * revokes the sessions. Nothing is ever sent to the old address.
 */
export async function changeMentorEmail(
  strapi: any,
  documentId: string,
  newEmail: string,
): Promise<
  | { mode: "invite-resent" | "confirmation-sent"; emailSent: boolean }
  | MentorAdminError
> {
  const user = await loadMentorTarget(strapi, documentId);
  if (isError(user)) return user;

  if (user.accountStatus === "deleted") {
    return { error: "Contul a fost șters.", status: 400 };
  }

  const email = newEmail.trim().toLowerCase();

  if (user.email.toLowerCase() === email) {
    return { error: "Aceasta este deja adresa contului.", status: 400 };
  }

  const taken = await strapi.db
    .query(USER_UID)
    .findOne({ where: { email: { $eqi: email } } });

  if (taken && taken.id !== user.id) {
    return {
      error: "Există deja un cont cu această adresă de email",
      status: 400,
    };
  }

  const userService = strapi.plugin("users-permissions").service("user");

  if (user.accountStatus === "pending") {
    await userService.edit(user.id, {
      email,
      // Strapi matches the login identifier against email *or* username.
      ...(user.username ? { username: email } : {}),
    });

    // The address is already saved, so a throwing send must not become a 500.
    let emailSent = false;
    try {
      ({ emailSent } = await strapi
        .service("api::auth.auth")
        .resendMentorInvite(user.id));
    } catch (error) {
      console.error("changeMentorEmail invite resend failed", error);
    }

    return { mode: "invite-resent", emailSent };
  }

  const token = signAdminEmailChangeToken(user.id, email);

  // Stored so the token is single-use and supersedes any earlier request.
  await userService.edit(user.id, { emailChangeToken: token });

  let emailSent = true;
  try {
    await (
      strapi.service("api::email.email") as EmailService
    ).sendAdminEmailChangeConfirmation({
      to: email,
      nume: user.nume,
      link: buildEmailChangeLink(token),
    });
  } catch (error) {
    console.error("changeMentorEmail email delivery failed", error);
    emailSent = false;
  }

  return { mode: "confirmation-sent", emailSent };
}

/** True when the mentor appears in any assignment, conversation, message or meeting. */
export async function hasMentoringHistory(
  strapi: any,
  userId: number,
): Promise<boolean> {
  for (const [uid, field] of MENTOR_HISTORY_RELATIONS) {
    const count = await strapi.db
      .query(uid)
      .count({ where: { [field]: { id: userId } } });
    if (count > 0) return true;
  }
  return false;
}

/**
 * FDSC admin deletes a mentor account.
 *
 * A pending account that never took part in any mentoring is removed outright.
 * Anything else is anonymized exactly like a self-service deletion, so the
 * organizations keep the conversations, meetings and reports of the person.
 * Runs in one transaction; the avatar file on disk/S3 is the only write that
 * cannot roll back (see `performAccountDeletion`).
 */
export async function deleteMentor(
  strapi: any,
  documentId: string,
): Promise<{ mode: "deleted" | "anonymized" } | MentorAdminError> {
  return strapi.db.transaction(async () => {
    const user = await loadMentorTarget(strapi, documentId);
    if (isError(user)) return user;

    if (user.accountStatus === "deleted") {
      return { error: "Contul a fost deja șters.", status: 400 };
    }

    if (
      user.accountStatus === "pending" &&
      !(await hasMentoringHistory(strapi, user.id))
    ) {
      await deleteUploadedFile(strapi, user.avatar);
      await strapi.documents(USER_UID).delete({ documentId });
      return { mode: "deleted" as const };
    }

    // Assignments are deliberately kept: BR-34 only requires the personal data
    // to go, so `program.mentors` / `ngo-mentor` rows stay and render under the
    // anonymous name. See the same note in auth/services/delete-account.ts.
    await (
      strapi.service("api::refresh-token.refresh-token") as RefreshTokenService
    ).revokeAllForUser(user.id);

    await deleteUploadedFile(strapi, user.avatar);

    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(user.id, {
        ...buildAnonymizedUserData(user.documentId),
        password: crypto.randomBytes(24).toString("hex"),
      });

    return { mode: "anonymized" as const };
  });
}
