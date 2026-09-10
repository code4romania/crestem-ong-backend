import { describe, expect, it } from "vitest";
import { countBySubcategoryId, type CountableArticle } from "./counts";

const articles: CountableArticle[] = [
  { subcategorie: { documentId: "sub-a" } },
  { subcategorie: { documentId: "sub-a" } },
  { subcategorie: { documentId: "sub-b" } },
];

describe("countBySubcategoryId", () => {
  it("counts per subcategory", () => {
    const counts = countBySubcategoryId(articles);
    expect(counts.get("sub-a")).toBe(2);
    expect(counts.get("sub-b")).toBe(1);
  });

  it("omits a subcategory with nothing in it", () => {
    expect(countBySubcategoryId(articles).has("sub-c")).toBe(false);
  });

  it("ignores an article with no subcategory", () => {
    const counts = countBySubcategoryId([...articles, { subcategorie: null }]);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(3);
  });

  // The whole point of extracting this: the caller decides WHICH articles to
  // count, so the same rule serves the drafts-included admin tree and the
  // visibility-filtered public one.
  it("counts exactly the articles it is given, nothing more", () => {
    const counts = countBySubcategoryId([articles[0]]);
    expect(counts.get("sub-a")).toBe(1);
    expect(counts.has("sub-b")).toBe(false);
  });
});
