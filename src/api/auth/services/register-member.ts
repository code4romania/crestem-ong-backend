import { addOngMembership } from "../../../utils/membership";
import type { MemberCreatePayload, InviteCreateResult } from "../interfaces/auth";

const USER_UID = "plugin::users-permissions.user";

type Ong = { id: number; documentId: string; name: string };

export type MemberRegistrationResult =
  | { attached: true; id: number }
  | {
      attached: false;
      id: number;
      emailSent: boolean;
      activationLink?: string;
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
  const existing = await strapi.db
    .query(USER_UID)
    .findOne({ where: { email: { $eqi: data.email } } });

  if (existing) {
    await addOngMembership(strapi, existing.documentId, ong.documentId, data.rol);
    return { attached: true, id: existing.id };
  }

  const result = await createMember(data, ong);
  return { attached: false, ...result };
}
