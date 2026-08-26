import crypto from "crypto";
import { buildAnonymizedUserData } from "../../../utils/anonymize";
import { accountDeletionBlock } from "../../../utils/account-deletion";
import { removeOngMembership } from "../../../utils/membership";
import { deleteUploadedFile } from "../../../utils/media";
import type { DeleteAccountPayload } from "../interfaces/auth";
import type { RefreshTokenService } from "../../refresh-token/services/refresh-token";

const USER_UID = "plugin::users-permissions.user";
const JOIN_REQUEST_UID = "api::ong-join-request.ong-join-request";

/**
 * Self-service account deletion (BR-24 … BR-28).
 *
 * The whole cascade runs inside `strapi.db.transaction`, so it either lands
 * completely or not at all. Everything reached from here writes through
 * `strapi.db` / the document service and therefore joins that transaction via
 * the async-local context: `removeOngMembership`,
 * the join-request deletes, `revokeAllForUser`, the `plugin::upload.file` row
 * delete inside the upload service's `remove`, and the users-permissions
 * `user.edit` (which is a `strapi.db.query(...).update` underneath).
 *
 * The one write that does NOT roll back is the physical avatar file: the upload
 * provider deletes it from disk/S3 outside any database transaction. It is
 * removed just before the relation is cleared, so an aborted deletion leaves a
 * broken image reference rather than an unreachable orphan still holding the
 * person's name in its filename.
 *
 * Order still matters inside the transaction: memberships are ended first so
 * `removeOngMembership` can demote the account to `individual` while the row is
 * still readable, and the anonymizing write lands last.
 */
export async function performAccountDeletion(
  strapi: any,
  userId: number,
  data: DeleteAccountPayload,
): Promise<void> {
  await strapi.db.transaction(async () => {
    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      populate: ["role", "ong", "avatar"],
    });

    if (!user || user.accountStatus !== "active") {
      throw new Error("Contul nu a fost găsit");
    }

    const isCurrentPasswordValid = await strapi
      .plugin("users-permissions")
      .service("user")
      .validatePassword(data.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new Error("Parola actuală este incorectă");
    }

    const superAdminCount =
      user.role?.type === "super-admin"
        ? await strapi.db.query(USER_UID).count({
            where: { role: { type: "super-admin" }, accountStatus: "active" },
          })
        : 0;

    const blocked = accountDeletionBlock({
      roleType: user.role?.type,
      superAdminCount,
    });
    if (blocked) {
      throw new Error(blocked);
    }

    for (const ong of (user.ong ?? []) as any[]) {
      if (!ong?.documentId) continue;
      await removeOngMembership(strapi, user.documentId, ong.documentId);
    }

    // Mentoring assignments are deliberately NOT ended here. BR-34 only
    // requires the personal data to go; the `program.mentors` / `ngo-mentor`
    // rows stay so the organization keeps seeing the conversation, the
    // meetings and the reports of the person who worked with it — rendered
    // read-only and greyed, under the `Anonim <documentId>` name of BR-27.
    // Detaching instead invalidated the (program, mentor) pair that
    // `conversation/utils/sync` filters on, and the chat vanished.

    const pendingRequests: any[] = await strapi.documents(JOIN_REQUEST_UID).findMany({
      filters: { user: { documentId: user.documentId }, status: "pending" },
    });
    for (const request of pendingRequests) {
      await strapi.documents(JOIN_REQUEST_UID).delete({
        documentId: request.documentId,
      });
    }

    await (
      strapi.service("api::refresh-token.refresh-token") as RefreshTokenService
    ).revokeAllForUser(user.id);

    // `avatar: null` in the anonymized data only severs the relation; the file
    // itself has to go too (BR-26).
    await deleteUploadedFile(strapi, user.avatar);

    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(user.id, {
        ...buildAnonymizedUserData(user.documentId),
        // The hash is personal data of no further use; replacing it makes the
        // credential unusable even if `blocked` were ever cleared by hand.
        password: crypto.randomBytes(24).toString("hex"),
      });
  });
}
