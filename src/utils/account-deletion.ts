/**
 * Preconditions for self-service account deletion (BR-32, BR-35).
 *
 * The shape of both rules is the same: an account cannot be deleted while it is
 * the sole holder of a role somebody must hold. `ngo-admin` is a single global
 * Strapi role, so holding it at all means being the contact person of an
 * organization — the user must first transfer the role or delete the ONG.
 */

export interface DeletionContext {
  roleType?: string;
  /** Number of accounts with role type `super-admin`, including this one. */
  superAdminCount: number;
}

export const NGO_ADMIN_BLOCK_REASON =
  "Ești persoana de contact a organizației. Transferă rolul altui membru sau șterge organizația înainte de a-ți șterge contul.";

export const LAST_SUPER_ADMIN_BLOCK_REASON =
  "Ești ultimul administrator al platformei. Contul nu poate fi șters.";

export function accountDeletionBlock(input: DeletionContext): string | null {
  if (input.roleType === "ngo-admin") {
    return NGO_ADMIN_BLOCK_REASON;
  }
  if (input.roleType === "super-admin" && input.superAdminCount <= 1) {
    return LAST_SUPER_ADMIN_BLOCK_REASON;
  }
  return null;
}
