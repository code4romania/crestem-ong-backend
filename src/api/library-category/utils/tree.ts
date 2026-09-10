/**
 * The taxonomy is exactly two levels deep. Keeping the rule here, as a pure
 * function over rows, is what makes it testable without a request — and it is
 * the rule with real consequences: a third level would produce article URLs
 * the public routes cannot address.
 */
export interface CategoryRow {
  documentId: string;
  parinte: string | null;
}

export function checkParent({
  categoryId,
  parentId,
  rows,
}: {
  categoryId: string | null;
  parentId: string | null;
  rows: CategoryRow[];
}): string | null {
  // The top level is always available, both for a new category and for one
  // being promoted back out of a parent.
  if (!parentId) return null;

  if (categoryId !== null && parentId === categoryId) {
    return "O categorie nu poate fi propriul părinte";
  }

  const parent = rows.find((row) => row.documentId === parentId);
  if (!parent) return "Categoria părinte nu există";

  // Rule 1: a subcategory may not take children.
  if (parent.parinte) return "Subcategoriile nu pot avea subcategorii";

  // Rule 3: the same violation arriving from the other direction — an existing
  // category with children being demoted under someone else.
  const hasChildren = categoryId !== null && rows.some((row) => row.parinte === categoryId);
  if (hasChildren) return "O categorie cu subcategorii nu poate deveni subcategorie";

  return null;
}
