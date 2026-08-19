/**
 * `resetPasswordToken` doubles as the activation token while a user is
 * pending — it's marked `private` on the schema, so the Document Service
 * strips it automatically and this has to go through the low-level query API.
 */
export async function pendingActivationTokens(
  strapi: any,
  documentIds: string[],
): Promise<Map<string, string>> {
  const tokens = new Map<string, string>();
  if (documentIds.length === 0) return tokens;
  const rows = await strapi.db
    .query("plugin::users-permissions.user")
    .findMany({
      where: { documentId: { $in: documentIds }, accountStatus: "pending" },
      select: ["documentId", "resetPasswordToken"],
    });
  for (const row of rows as any[]) {
    if (row.resetPasswordToken) {
      tokens.set(row.documentId, row.resetPasswordToken);
    }
  }
  return tokens;
}
