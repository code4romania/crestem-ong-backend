import { isFdscStaff } from "../../../utils/fdsc-staff";

export const ADMIN_USER_FORBIDDEN_MESSAGE =
  "Nu ai permisiunea de a administra acest utilizator.";

/**
 * Who may *read* a user record. `editor-fdsc` reaches these endpoints only
 * because the "Persoane resursă" screen lists mentors through them, so it sees
 * mentors and nothing else. Everything the "Utilizatori" screen offers — staff
 * and organization accounts — stays out of reach, and it stays out of reach
 * here rather than in the interface, so a direct call to
 * `/api/admin/users/:documentId` cannot get around the missing navigation entry.
 */
export function canActOnUser(
  actorRoleType?: string | null,
  targetRoleType?: string | null,
): boolean {
  if (!isFdscStaff(actorRoleType)) return false;
  if (actorRoleType === "super-admin") return true;
  return targetRoleType === "mentor";
}

/**
 * Who may *write* a user record. The editor's view of "Persoane resursă" is
 * read-only — no adding, editing or removing — so every write belongs to the
 * administrator alone, mentor targets included. The route already carries
 * `global::is-super-admin`; this repeats the rule where the record is known, so
 * the controller cannot be reached with a weaker guard by mistake.
 */
export function canEditUser(actorRoleType?: string | null): boolean {
  return actorRoleType === "super-admin";
}

/**
 * The role a listing is restricted to. An editor is pinned to mentors whatever
 * the query string asks for, so the listing cannot be used to enumerate staff
 * or organization accounts.
 */
export function resolveAdminUserRoleFilter(
  actorRoleType?: string | null,
  requestedRoleType?: string | null,
): string {
  if (actorRoleType === "super-admin") return requestedRoleType ?? "";
  return "mentor";
}
