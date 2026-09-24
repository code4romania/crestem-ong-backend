import {
  cancelPendingInvite,
  removeOngMembership,
} from "../../../utils/membership";
import { detachOngFromMentorAssignments } from "../../../utils/mentor-assignments";
import { deleteUploadedFile } from "../../../utils/media";
import type { EmailService } from "../../email/services/email";
import { cancelForOngDeletion } from "../../admin-transfer/services/transfer-flow";
import { createTransferDeps } from "../../admin-transfer/services/repository";

const ONG_UID = "api::ong.ong";
const USER_UID = "plugin::users-permissions.user";
const JOIN_REQUEST_UID = "api::ong-join-request.ong-join-request";

export interface AnonymizedOngData {
  name: string;
  cui: string;
  website: null;
  adresa: null;
  descriere: null;
  cuvinteCheie: null;
  socialMedia: null;
  logo: null;
  judet: null;
  localitate: null;
  dataInfiintare: null;
  domeniuPrincipal: null;
  domeniuSecundar: null;
  ngoStatus: "deleted";
}

/**
 * `cui` is `unique` and `required`, so it cannot be nulled — a documentId-derived
 * placeholder frees the real fiscal code for a future registration. `ngoStatus`
 * is the other `required` attribute and is set, not nulled. Every remaining
 * field on the schema is optional and is cleared outright.
 *
 * `judet`, `localitate`, `dataInfiintare`, `domeniuPrincipal` and
 * `domeniuSecundar` are cleared too: county plus city plus founding date plus
 * activity domain, combined with the program enrollment and the evaluation
 * history that BR-33 deliberately preserves, re-identifies the great majority
 * of Romanian NGOs. Accepted consequence: FDSC reports that group organizations
 * by county or by domain no longer break these rows out.
 *
 * Four of the five are `manyToOne` relations, not scalars. `null` is the Strapi 5
 * relation input for "clear this relation": the document service passes it
 * straight through (`mapRelation` short-circuits on nil) and the database layer
 * turns it into `{ set: null }`. The same form `logo` already uses.
 */
export function buildAnonymizedOngData(documentId: string): AnonymizedOngData {
  return {
    name: "Organizație ștearsă",
    cui: `deleted-${documentId}`,
    website: null,
    adresa: null,
    descriere: null,
    cuvinteCheie: null,
    socialMedia: null,
    logo: null,
    judet: null,
    localitate: null,
    dataInfiintare: null,
    domeniuPrincipal: null,
    domeniuSecundar: null,
    ngoStatus: "deleted",
  };
}

/**
 * `Șterge ONG` (BR-33).
 *
 * Reports, evaluations, conversations and messages are deliberately left in
 * place: they stay in the program's history and keep counting toward its
 * scores, rendered against an anonymous organization. Programs still list the
 * ONG; the frontend derives the "Retras" badge from `ngoStatus === "deleted"`.
 *
 * The whole cascade runs inside `strapi.db.transaction`, so it either lands
 * completely or not at all. Every write reached from here goes through the
 * document service or `strapi.db.query` and joins that transaction via the
 * async-local context — the membership updates, the join-request deletes, the
 * ngo-mentor detach, the `plugin::upload.file` row delete inside the upload
 * service's `remove`, and the anonymizing update.
 *
 * The one write that does NOT roll back is the physical logo file: the upload
 * provider deletes it from disk/S3 outside any database transaction. It is
 * removed just before the relation is cleared, so an aborted deletion leaves a
 * broken image reference rather than an unreachable orphan.
 *
 * `actorDocumentId` is the user who asked for the deletion, so they can be left
 * out of the notification — they know. FDSC staff are not members, so passing
 * their id simply matches nobody and the whole membership, ngo-admin included,
 * is notified.
 */
export async function performOngDeletion(
  strapi: any,
  ongDocumentId: string,
  actorDocumentId?: string,
): Promise<{ emailSent: boolean }> {
  const recipients = await strapi.db.transaction(async () => {
    // A pending "Transferă organizația" dies with the organization, and the
    // account its invite created goes with it (spec D5). Silent: the deletion
    // mail below already tells everyone concerned.
    await cancelForOngDeletion(createTransferDeps(strapi), ongDocumentId);

    const members: any[] = await strapi.documents(USER_UID).findMany({
      filters: { ong: { documentId: ongDocumentId } },
      populate: { role: true },
    });

    // An activated member keeps their account and every other affiliation; only
    // this membership ends, and `removeOngMembership` demotes them to
    // `individual` when it was their last one. A `pending` invite has no
    // identity to preserve — it exists only because this organization created
    // it — so `cancelPendingInvite` deletes the account outright rather than
    // leaving an "individual" stub squatting on the email address.
    for (const member of members) {
      if (!member?.documentId) continue;
      if (member.accountStatus === "pending") {
        await cancelPendingInvite(strapi, member.documentId, ongDocumentId);
        continue;
      }
      await removeOngMembership(strapi, member.documentId, ongDocumentId);
    }

    const pendingRequests: any[] = await strapi.documents(JOIN_REQUEST_UID).findMany({
      filters: { ong: { documentId: ongDocumentId }, status: "pending" },
    });
    for (const request of pendingRequests) {
      await strapi.documents(JOIN_REQUEST_UID).delete({
        documentId: request.documentId,
      });
    }

    // The mentoring assignment ends with the organization (BR-33): the
    // (ong, program, mentor) pair stops being valid, so the conversation
    // disappears from the mentor's list. It is not sealed — `sendMessageForMentor`
    // validates only that `conversation.mentor` is the caller, so a direct POST
    // with a known conversation id is still accepted. Pre-existing platform
    // behaviour, out of scope here.
    await detachOngFromMentorAssignments(strapi, ongDocumentId);

    const ong = await strapi.documents(ONG_UID).findOne({
      documentId: ongDocumentId,
      populate: { logo: true },
    });
    // `logo: null` in the anonymized data only severs the relation; the file
    // itself has to go too.
    await deleteUploadedFile(strapi, ong?.logo);

    // The name is read before the anonymizing update overwrites it with
    // "Organizație ștearsă" — the notification has to name the real one.
    const ongName = ong?.name;

    await strapi.documents(ONG_UID).update({
      documentId: ongDocumentId,
      data: buildAnonymizedOngData(ongDocumentId),
    });

    return members
      .filter(
        (member) =>
          member?.email &&
          member.accountStatus !== "pending" &&
          member.documentId !== actorDocumentId,
      )
      .map((member) => ({
        to: member.email,
        nume: member.nume,
        ongName,
      }));
  });

  return { emailSent: await notifyMembers(strapi, recipients) };
}

/**
 * Announces the deletion to the members, one mail at a time.
 *
 * Called only after `strapi.db.transaction` has resolved: a mail announcing a
 * deletion that then rolls back cannot be recalled. By the same token a
 * delivery failure cannot undo anything either, so it is logged and the
 * remaining members are still mailed — the caller reports it through
 * `emailSent`, exactly as `assignOngs` does.
 */
async function notifyMembers(
  strapi: any,
  recipients: Array<{ to: string; nume: string; ongName: string }>,
): Promise<boolean> {
  let emailSent = true;
  for (const recipient of recipients) {
    try {
      await (
        strapi.service("api::email.email") as EmailService
      ).sendOngDeleted(recipient);
    } catch (error) {
      console.error("ong deletion notification delivery failed", error);
      emailSent = false;
    }
  }
  return emailSent;
}
