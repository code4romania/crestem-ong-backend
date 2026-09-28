import { addOngMembership } from "../../../utils/membership";
import type { EmailService } from "../../email/services/email";
import {
  ACTIVATION_PATH,
  buildActivationLink,
  buildLoginLink,
  signActivationToken,
} from "../utils/auth";
import type { MemberCreatePayload, InviteCreateResult } from "../interfaces/auth";

const USER_UID = "plugin::users-permissions.user";

type Ong = { id: number; documentId: string; name: string };

type ExistingUser = {
  id: number;
  documentId: string;
  email: string;
  nume: string;
  accountStatus?: string;
};

export type MemberRegistrationResult =
  | {
      attached: true;
      id: number;
      /** The user was already in this organization — no email is sent. */
      alreadyMember: boolean;
      emailSent: boolean;
    }
  | {
      attached: false;
      id: number;
      emailSent: boolean;
    };

/**
 * An NGO admin adding a member by email may be naming someone who already
 * has an account elsewhere on the platform. Creating a second account would
 * collide on email, so an existing user is attached to the organization
 * (BR: same membership model `acceptJoinRequest` uses) instead of going
 * through `createMember`.
 */
export async function registerOrAttachMember(
  strapi: any,
  data: MemberCreatePayload,
  ong: Ong,
  createMember: (
    data: MemberCreatePayload,
    ong: Ong,
  ) => Promise<InviteCreateResult>,
): Promise<MemberRegistrationResult> {
  const existing: ExistingUser | null = await strapi.db
    .query(USER_UID)
    .findOne({ where: { email: { $eqi: data.email } } });

  if (existing) {
    const added = await addOngMembership(
      strapi,
      existing.documentId,
      ong.documentId,
      data.rol,
    );
    if (!added) {
      return { attached: true, id: existing.id, alreadyMember: true, emailSent: false };
    }

    let emailSent = true;
    try {
      await notifyAttachedMember(strapi, existing, ong);
    } catch (error) {
      console.error("registerOrAttachMember email delivery failed", error);
      emailSent = false;
    }
    return { attached: true, id: existing.id, alreadyMember: false, emailSent };
  }

  const result = await createMember(data, ong);
  return { attached: false, ...result };
}

/**
 * An active account only needs to hear it was added, with a link to log in.
 * A still-pending account (invited elsewhere, never activated) has no
 * password yet, so a login link would be a dead end — it gets a fresh
 * activation link for this organization instead.
 */
async function notifyAttachedMember(
  strapi: any,
  user: ExistingUser,
  ong: Ong,
) {
  const emailService = strapi.service("api::email.email") as EmailService;

  if (user.accountStatus === "pending") {
    const token = signActivationToken(user.id);
    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(user.id, { resetPasswordToken: token });
    await emailService.sendMemberActivation({
      to: user.email,
      nume: user.nume,
      ongName: ong.name,
      link: buildActivationLink(token, ACTIVATION_PATH),
    });
    return;
  }

  await emailService.sendMemberAdded({
    to: user.email,
    nume: user.nume,
    ongName: ong.name,
    link: buildLoginLink(),
  });
}
