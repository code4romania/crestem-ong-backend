import { describe, expect, it } from "vitest";
import { articlePath } from "./path";

const article = {
  slug: "ghid-fiscal",
  subcategorie: { slug: "fiscalitate", parinte: { slug: "juridic-fiscal" } },
};

describe("articlePath", () => {
  it("assembles the path from the relation", () => {
    expect(articlePath(article)).toBe("/biblioteca/juridic-fiscal/fiscalitate/ghid-fiscal");
  });

  it("returns null when the subcategory is missing", () => {
    expect(articlePath({ slug: "ghid-fiscal", subcategorie: null })).toBeNull();
  });

  it("returns null when the parent is not populated", () => {
    expect(
      articlePath({ slug: "ghid-fiscal", subcategorie: { slug: "fiscalitate", parinte: null } }),
    ).toBeNull();
  });

  it("returns null when the article has no slug", () => {
    expect(articlePath({ ...article, slug: "" })).toBeNull();
  });
});
