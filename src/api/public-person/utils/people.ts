/**
 * Shaping helpers for the people-directory endpoint. The public site's "People
 * Collection" block lists platform people, which are `users-permissions.user`
 * rows — mentors ("Persoană resursă") plus FDSC staff ("Echipa FDSC"). Kept
 * pure and separate from the controller so the mapping/parsing is unit-tested.
 */

/** Role types that surface in the directory, widest ("Toate") first. */
export const DIRECTORY_ROLE_TYPES = [
  "mentor",
  "editor-fdsc",
  "super-admin",
] as const;

export type DirectoryRoleType = (typeof DIRECTORY_ROLE_TYPES)[number];

export type PersonType = "persoana-resursa" | "echipa-fdsc";

export interface DirectoryProgram {
  documentId: string;
  name: string;
}

export interface DirectoryPerson {
  documentId: string;
  nume: string;
  functie: string;
  organizatie: string;
  tip: PersonType;
  programe: DirectoryProgram[];
  avatar: { url: string; name: string } | null;
  adaugatLa: string;
}

export interface PeopleQuery {
  /** Role types to include, already narrowed by the `type` filter. */
  roleTypes: DirectoryRoleType[];
  /** Programme documentIds to intersect against; empty === no programme filter. */
  programIds: string[];
  sort: "az" | "za" | "recente";
  /** Positive integer cap, or `null` for "Toate". */
  limit: number | null;
}

/** `mentor` is the only "Persoană resursă"; every other directory role is staff. */
export function personTypeFor(roleType: string | null | undefined): PersonType {
  return roleType === "mentor" ? "persoana-resursa" : "echipa-fdsc";
}

/** Parse the raw query string of `GET /api/people-directory` into typed options. */
export function parsePeopleQuery(query: Record<string, unknown>): PeopleQuery {
  const type = typeof query.type === "string" ? query.type : "";
  const roleTypes: DirectoryRoleType[] =
    type === "persoana-resursa"
      ? ["mentor"]
      : type === "echipa-fdsc"
        ? ["editor-fdsc", "super-admin"]
        : [...DIRECTORY_ROLE_TYPES];

  const programeRaw = typeof query.programe === "string" ? query.programe : "";
  const programIds = [
    ...new Set(
      programeRaw
        .split(",")
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ];

  const sortRaw = typeof query.sort === "string" ? query.sort : "";
  const sort: PeopleQuery["sort"] =
    sortRaw === "za" || sortRaw === "recente" ? sortRaw : "az";

  const limitRaw = typeof query.limit === "string" ? Number(query.limit) : NaN;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : null;

  return { roleTypes, programIds, sort, limit };
}

export interface ProgramWithMentors {
  documentId: string;
  name: string;
  mentors?: ({ documentId: string } | null)[] | null;
}

/**
 * Invert `program.mentors` into `userDocumentId -> programmes`. The relation has
 * no inverse on the user side, so the caller loads every programme with its
 * mentors and passes them here.
 */
export function buildProgramMap(
  programs: ProgramWithMentors[],
): Map<string, DirectoryProgram[]> {
  const byUser = new Map<string, DirectoryProgram[]>();
  for (const program of programs) {
    for (const mentor of program.mentors ?? []) {
      if (!mentor) continue;
      const list = byUser.get(mentor.documentId) ?? [];
      list.push({ documentId: program.documentId, name: program.name });
      byUser.set(mentor.documentId, list);
    }
  }
  return byUser;
}

export interface DirectoryUser {
  documentId: string;
  /** Nullable in practice — rows seeded before `nume` existed carry none. */
  nume?: string | null;
  username?: string | null;
  mentorJobTitle?: string | null;
  mentorOrganization?: string | null;
  createdAt: string;
  role?: { type?: string | null } | null;
  avatar?: { url: string; name?: string | null } | null;
}

/** Map a loaded user + the programme index to the public directory shape. */
export function toDirectoryPerson(
  user: DirectoryUser,
  programMap: Map<string, DirectoryProgram[]>,
): DirectoryPerson {
  const roleType = user.role?.type ?? null;
  return {
    documentId: user.documentId,
    // Always a string downstream — the block derives avatar initials from it.
    nume: user.nume?.trim() || user.username?.trim() || "",
    functie: user.mentorJobTitle ?? "",
    organizatie: user.mentorOrganization ?? "",
    tip: personTypeFor(roleType),
    // Only mentors carry programmes; staff are never programme-filterable.
    programe: roleType === "mentor" ? (programMap.get(user.documentId) ?? []) : [],
    avatar: user.avatar
      ? { url: user.avatar.url, name: user.avatar.name ?? "" }
      : null,
    adaugatLa: user.createdAt,
  };
}

/** Apply the programme intersection + cap that can't run at the DB layer. */
export function applyProgrammeAndLimit(
  people: DirectoryPerson[],
  { programIds, limit }: Pick<PeopleQuery, "programIds" | "limit">,
): DirectoryPerson[] {
  let result = people;
  if (programIds.length > 0) {
    const wanted = new Set(programIds);
    result = result.filter((person) =>
      person.programe.some((programme) => wanted.has(programme.documentId)),
    );
  }
  if (limit !== null) result = result.slice(0, limit);
  return result;
}
