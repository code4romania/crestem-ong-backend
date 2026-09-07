import { isFdscStaff } from "../../../utils/fdsc-staff";

/** The six checkboxes in the page form. `fdsc` covers both staff roles. */
export const VISIBILITY_AUDIENCES = [
  "public",
  "fdsc",
  "mentor",
  "ngo-admin",
  "ngo-member",
  "individual",
] as const;

export type VisibilityAudience = (typeof VISIBILITY_AUDIENCES)[number];

export interface ViewablePage {
  publishedAt?: string | null;
  vizibilitate?: string[] | null;
}

/** Which audience a signed-in role belongs to, or null when anonymous. */
export function audienceForRole(
  roleType: string | null | undefined,
): VisibilityAudience | null {
  if (!roleType) return null;
  if (isFdscStaff(roleType)) return "fdsc";
  return (VISIBILITY_AUDIENCES as readonly string[]).includes(roleType)
    ? (roleType as VisibilityAudience)
    : null;
}

/**
 * The whole access rule for a public page, in one pure function so it can be
 * tested without a request. Getting it wrong leaks restricted content in one
 * direction and hides it from the entitled in the other.
 */
export function canView(
  page: ViewablePage,
  roleType: string | null | undefined,
): boolean {
  // A draft exists only for the people who edit it.
  if (!page.publishedAt) return isFdscStaff(roleType);

  const audiences = page.vizibilitate ?? [];
  if (audiences.includes("public")) return true;

  const audience = audienceForRole(roleType);
  return audience !== null && audiences.includes(audience);
}
