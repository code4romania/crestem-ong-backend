import { describe, expect, it } from "vitest";
import { checkParent, type CategoryRow } from "./tree";

// juridic is a category with one subcategory; leadership is a bare category.
const rows: CategoryRow[] = [
  { documentId: "juridic", parinte: null },
  { documentId: "fiscalitate", parinte: "juridic" },
  { documentId: "leadership", parinte: null },
];

describe("checkParent", () => {
  it("allows a new top-level category", () => {
    expect(checkParent({ categoryId: null, parentId: null, rows })).toBeNull();
  });

  it("allows a new subcategory under a category", () => {
    expect(checkParent({ categoryId: null, parentId: "juridic", rows })).toBeNull();
  });

  it("allows moving a childless category under another", () => {
    expect(checkParent({ categoryId: "leadership", parentId: "juridic", rows })).toBeNull();
  });

  it("allows moving a subcategory back to the top level", () => {
    expect(checkParent({ categoryId: "fiscalitate", parentId: null, rows })).toBeNull();
  });

  it("refuses a category as its own parent", () => {
    expect(checkParent({ categoryId: "juridic", parentId: "juridic", rows })).toBe(
      "O categorie nu poate fi propriul părinte",
    );
  });

  it("refuses a parent that does not exist", () => {
    expect(checkParent({ categoryId: null, parentId: "lipsa", rows })).toBe(
      "Categoria părinte nu există",
    );
  });

  it("refuses nesting under a subcategory", () => {
    expect(checkParent({ categoryId: null, parentId: "fiscalitate", rows })).toBe(
      "Subcategoriile nu pot avea subcategorii",
    );
  });

  it("refuses demoting a category that has subcategories", () => {
    expect(checkParent({ categoryId: "juridic", parentId: "leadership", rows })).toBe(
      "O categorie cu subcategorii nu poate deveni subcategorie",
    );
  });
});
