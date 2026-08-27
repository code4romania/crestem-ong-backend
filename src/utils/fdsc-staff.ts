/**
 * The two FDSC staff accounts. Both reach the same platform-side screens; the
 * only difference lives in user administration, which `editor-fdsc` does not
 * get (see `src/api/admin-user/utils/access.ts`).
 */
export const FDSC_STAFF_ROLES = ["super-admin", "editor-fdsc"] as const;

export type FdscStaffRole = (typeof FDSC_STAFF_ROLES)[number];

export function isFdscStaff(roleType?: string | null): boolean {
  return FDSC_STAFF_ROLES.includes(roleType as FdscStaffRole);
}
