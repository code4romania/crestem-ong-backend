import type { EmailService } from "../../email/services/email";
import { buildEvaluationLink } from "./invite-link";
import { docRef } from "../../../utils/relations";
import { isAnonymized } from "../../../utils/anonymize";

export interface MemberView {
  documentId: string;
  nume: string;
  /** `null` once the account is anonymized — the stored address is a placeholder. */
  email: string | null;
}

export const memberView = (user: any): MemberView => ({
  documentId: user.documentId,
  nume: user.nume,
  email: isAnonymized(user) ? null : user.email,
});

export const resolveMembers = async (
  strapi: any,
  ongDocumentId: string,
  memberDocumentIds: string[],
): Promise<{ members: any[] } | { error: string }> => {
  const unique = [...new Set(memberDocumentIds)];
  const users = await strapi
    .documents("plugin::users-permissions.user")
    .findMany({
      filters: { documentId: { $in: unique } },
      populate: { ong: true, role: true },
    });
  if (users.length !== unique.length) {
    return { error: "Unii utilizatori selectați nu există" };
  }
  for (const member of users) {
    // Checked before the membership rule: deletion clears `ong` and demotes the
    // role, so a deleted account always fails the membership check too — and
    // would then be reported with the generic message, quoting its
    // `deleted-…@anonim.local` placeholder as if it were an address. The
    // specific message has to win, so it is tested first.
    if (member.accountStatus === "deleted") {
      return {
        error: `Utilizatorul ${member.nume} și-a șters contul și nu mai poate fi invitat`,
      };
    }
    const inOng = ((member.ong ?? []) as any[]).some(
      (ong: any) => ong?.documentId === ongDocumentId,
    );
    const isRespondentRole = member.role?.type === "ngo-member" || member.role?.type === "ngo-admin";
    if (!inOng || !isRespondentRole) {
      return {
        error: `Utilizatorul ${member.email} nu este membru al organizației`,
      };
    }
    if (member.accountStatus !== "active") {
      return { error: `Utilizatorul ${member.email} nu are contul activat` };
    }
    if (member.blocked) {
      return { error: `Utilizatorul ${member.email} este blocat` };
    }
  }
  return { members: users };
};

export interface CreatedEvaluation {
  member: any;
  evaluationDocumentId: string;
}

export const createEvaluations = async (
  strapi: any,
  reportDocumentId: string,
  members: any[],
): Promise<CreatedEvaluation[]> => {
  const created: CreatedEvaluation[] = [];
  for (const member of members) {
    const evaluation = await strapi
      .documents("api::evaluation.evaluation")
      .create({
        data: {
          user: docRef(member.documentId),
          report: docRef(reportDocumentId),
        },
      });
    created.push({ member, evaluationDocumentId: evaluation.documentId });
  }
  return created;
};

export interface InviteResult {
  emailSent: boolean;
  failed: string[];
}

export const sendInvites = async (
  strapi: any,
  created: CreatedEvaluation[],
  ongName: string,
  deadline?: string,
): Promise<InviteResult> => {
  const failed: string[] = [];
  for (const { member, evaluationDocumentId } of created) {
    try {
      await (
        strapi.service("api::email.email") as EmailService
      ).sendEvaluationInvite({
        to: member.email,
        nume: member.nume,
        ongName,
        link: buildEvaluationLink(evaluationDocumentId),
        deadline,
      });
    } catch (error) {
      console.error("evaluation invite email delivery failed", error);
      failed.push(member.email);
      continue;
    }
    try {
      await strapi.documents("api::evaluation.evaluation").update({
        documentId: evaluationDocumentId,
        data: { notificationSentAt: new Date().toISOString() },
      });
    } catch (error) {
      console.error("evaluation invite timestamp update failed", error);
    }
  }
  return { emailSent: failed.length === 0, failed };
};
