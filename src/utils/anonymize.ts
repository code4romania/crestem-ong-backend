/**
 * Account deletion is a soft delete (BR-24): the user row survives so that
 * evaluations, messages and reports keep a valid relation, while every
 * identifying field is overwritten with a value derived from the documentId.
 *
 * `email` and `username` are `unique` in the schema, so they cannot be nulled —
 * overwriting them with a placeholder is what actually frees the real address
 * for reuse by a future account (BR-28).
 */

export const ANONYMOUS_NAME_PREFIX = "Anonim";

/** Displayed wherever the account's name used to appear (BR-27). */
export const anonymousDisplayName = (documentId: string) =>
  `${ANONYMOUS_NAME_PREFIX} ${documentId}`;

export const anonymousEmail = (documentId: string) =>
  `deleted-${documentId}@anonim.local`;

export const anonymousUsername = (documentId: string) => `deleted-${documentId}`;

export const isAnonymized = (user: { accountStatus?: string } | null | undefined) =>
  user?.accountStatus === "deleted";

export interface AnonymizedUserData {
  nume: string;
  email: string;
  username: string;
  telefon: null;
  avatar: null;
  mentorJobTitle: null;
  mentorOrganization: null;
  resetPasswordToken: null;
  confirmationToken: null;
  emailChangeToken: null;
  blocked: true;
  accountStatus: "deleted";
}

export function buildAnonymizedUserData(documentId: string): AnonymizedUserData {
  return {
    nume: anonymousDisplayName(documentId),
    email: anonymousEmail(documentId),
    username: anonymousUsername(documentId),
    telefon: null,
    avatar: null,
    mentorJobTitle: null,
    mentorOrganization: null,
    resetPasswordToken: null,
    confirmationToken: null,
    emailChangeToken: null,
    blocked: true,
    accountStatus: "deleted",
  };
}
