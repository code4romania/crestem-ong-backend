const USER_MODEL_UID = "plugin::users-permissions.user";

const loadUserWithMemberships = (strapi: any, userDocumentId: string) =>
  strapi.documents(USER_MODEL_UID).findOne({
    documentId: userDocumentId,
    populate: { role: true, ongMemberships: { populate: { ong: true } } },
  });

export async function addOngMembership(
  strapi: any,
  userDocumentId: string,
  ongDocumentId: string,
  rolMembruOng?: string,
) {
  const user = await loadUserWithMemberships(strapi, userDocumentId);
  if (!user) return;
  const memberships = (user.ongMemberships ?? []) as any[];
  if (memberships.some((entry) => entry.ong?.documentId === ongDocumentId)) {
    return;
  }
  const updateData: Record<string, unknown> = {
    ongMemberships: [
      ...memberships.map((entry) => ({
        id: entry.id,
        ong: { documentId: entry.ong.documentId },
        rolMembruOng: entry.rolMembruOng ?? undefined,
      })),
      { ong: { documentId: ongDocumentId }, rolMembruOng },
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
  const memberships = (user?.ongMemberships ?? []) as any[];
  const membership = memberships.find(
    (entry) => entry.ong?.documentId === ongDocumentId,
  );
  if (!user || !membership) {
    return { error: "Membrul nu a fost găsit" };
  }
  const remaining = memberships.filter(
    (entry) => entry.ong?.documentId !== ongDocumentId,
  );
  const updateData: Record<string, unknown> = {
    ongMemberships: remaining.map((entry) => ({
      id: entry.id,
      ong: { documentId: entry.ong.documentId },
      rolMembruOng: entry.rolMembruOng ?? undefined,
    })),
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
