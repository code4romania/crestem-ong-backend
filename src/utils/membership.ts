import { docRef } from "./relations";

const USER_MODEL_UID = "plugin::users-permissions.user";
const NGO_MEMBER_ROLE_UID = "api::ngo-member-role.ngo-member-role";

const loadUserWithMemberships = (strapi: any, userDocumentId: string) =>
  strapi.documents(USER_MODEL_UID).findOne({
    documentId: userDocumentId,
    populate: { role: true, ong: true },
  });

const findNgoMemberRoleEntries = (
  strapi: any,
  userDocumentId: string,
  ongDocumentId: string,
): Promise<any[]> =>
  strapi.documents(NGO_MEMBER_ROLE_UID).findMany({
    filters: {
      ngoMember: { documentId: userDocumentId },
      ngo: { documentId: ongDocumentId },
    },
  });

/**
 * Upsert the member's function inside one organization.
 *
 * The pair (member, ong) cannot be made unique in a Strapi schema, so
 * uniqueness lives here: an existing row is updated, never duplicated.
 */
export async function setNgoMemberRole(
  strapi: any,
  userDocumentId: string,
  ongDocumentId: string,
  role: string,
) {
  const [existing] = await findNgoMemberRoleEntries(
    strapi,
    userDocumentId,
    ongDocumentId,
  );
  if (existing) {
    await strapi.documents(NGO_MEMBER_ROLE_UID).update({
      documentId: existing.documentId,
      data: { role },
    });
    return;
  }
  await strapi.documents(NGO_MEMBER_ROLE_UID).create({
    data: {
      ngoMember: docRef(userDocumentId),
      ngo: docRef(ongDocumentId),
      role,
    },
  });
}

export async function deleteNgoMemberRole(
  strapi: any,
  userDocumentId: string,
  ongDocumentId: string,
) {
  const entries = await findNgoMemberRoleEntries(
    strapi,
    userDocumentId,
    ongDocumentId,
  );
  for (const entry of entries) {
    await strapi.documents(NGO_MEMBER_ROLE_UID).delete({
      documentId: entry.documentId,
    });
  }
}

/** Roles of the given members inside one organization, keyed by user documentId. */
export async function getNgoMemberRoles(
  strapi: any,
  ongDocumentId: string,
  userDocumentIds: string[],
): Promise<Map<string, string>> {
  if (userDocumentIds.length === 0) return new Map();
  const entries: any[] = await strapi
    .documents(NGO_MEMBER_ROLE_UID)
    .findMany({
      filters: {
        ngo: { documentId: ongDocumentId },
        ngoMember: { documentId: { $in: userDocumentIds } },
      },
      populate: { ngoMember: true },
    });
  return new Map(
    entries
      .filter((entry) => entry.ngoMember?.documentId && entry.role)
      .map((entry) => [entry.ngoMember.documentId, entry.role as string]),
  );
}

/** Roles of one member across every organization they belong to, keyed by ong documentId. */
export async function getNgoMemberRolesForUser(
  strapi: any,
  userDocumentId: string,
): Promise<Map<string, string>> {
  const entries: any[] = await strapi
    .documents(NGO_MEMBER_ROLE_UID)
    .findMany({
      filters: { ngoMember: { documentId: userDocumentId } },
      populate: { ngo: true },
    });
  return new Map(
    entries
      .filter((entry) => entry.ngo?.documentId && entry.role)
      .map((entry) => [entry.ngo.documentId, entry.role as string]),
  );
}

export async function addOngMembership(
  strapi: any,
  userDocumentId: string,
  ongDocumentId: string,
  role: string,
) {
  const user = await loadUserWithMemberships(strapi, userDocumentId);
  if (!user) return;
  await setNgoMemberRole(strapi, user.documentId, ongDocumentId, role);
  const ongs = (user.ong ?? []) as any[];
  if (ongs.some((entry) => entry.documentId === ongDocumentId)) {
    return;
  }
  const updateData: Record<string, unknown> = {
    ong: [
      ...ongs.map((entry) => docRef(entry.documentId)),
      docRef(ongDocumentId),
    ],
  };
  if (user.role?.type === "individual") {
    const memberRole = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "ngo-member" } });
    if (memberRole) {
      updateData.role = memberRole.id;
    }
  }
  await strapi.documents(USER_MODEL_UID).update({
    documentId: user.documentId,
    data: updateData,
  });
}

export async function removeOngMembership(
  strapi: any,
  userDocumentId: string,
  ongDocumentId: string,
): Promise<{ error: string } | { data: { documentId: string } }> {
  const user = await loadUserWithMemberships(strapi, userDocumentId);
  const ongs = (user?.ong ?? []) as any[];
  const membership = ongs.find((entry) => entry.documentId === ongDocumentId);
  if (!user || !membership) {
    return { error: "Membrul nu a fost găsit" };
  }
  await deleteNgoMemberRole(strapi, user.documentId, ongDocumentId);
  const remaining = ongs.filter((entry) => entry.documentId !== ongDocumentId);
  const updateData: Record<string, unknown> = {
    ong: remaining.map((entry) => docRef(entry.documentId)),
  };
  if (remaining.length === 0) {
    const individualRole = await strapi.db
      .query("plugin::users-permissions.role")
      .findOne({ where: { type: "individual" } });
    if (individualRole) {
      updateData.role = individualRole.id;
    }
  }
  await strapi.documents(USER_MODEL_UID).update({
    documentId: user.documentId,
    data: updateData,
  });
  return { data: { documentId: user.documentId } };
}
