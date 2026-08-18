export const docRef = (documentId: string) => ({ documentId });

export const docRefs = (documentIds: string[]) => documentIds.map(docRef);
