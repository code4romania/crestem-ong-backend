const UID = "api::article-read.article-read";

/**
 * One row per (user, article). A repeat read updates the existing row's
 * `accessedAt` rather than adding another, so "articles read" stays a list of
 * distinct articles, each showing the most recent visit.
 */
export async function upsertArticleRead(
  strapiInstance: any,
  userDocumentId: string,
  articleDocumentId: string,
) {
  const accessedAt = new Date().toISOString();

  const existing = await strapiInstance.documents(UID).findFirst({
    filters: {
      user: { documentId: userDocumentId },
      article: { documentId: articleDocumentId },
    },
  });

  if (existing) {
    return strapiInstance.documents(UID).update({
      documentId: existing.documentId,
      data: { accessedAt },
    });
  }

  return strapiInstance.documents(UID).create({
    data: {
      user: { connect: [userDocumentId] },
      article: { connect: [articleDocumentId] },
      accessedAt,
    } as any,
  });
}
