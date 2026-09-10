import { describe, expect, it } from "vitest";
import {
  browseArticles,
  distinctTipuri,
  matchesBrowse,
  type BrowseArticle,
  type BrowseFilters,
} from "./browse";

const fiscal: BrowseArticle = {
  titlu: "Ghid fiscal pentru ONG-uri",
  rezumat: "Impozite, scutiri și obligații",
  tip: "Ghid",
  subcategorie: { slug: "fiscalitate", parinte: { slug: "juridic-fiscal" } },
};
const contract: BrowseArticle = {
  titlu: "Model de contract",
  rezumat: "Un model uzual de colaborare",
  tip: "Template",
  subcategorie: { slug: "contracte", parinte: { slug: "juridic-fiscal" } },
};
const buget: BrowseArticle = {
  titlu: "Planificare bugetară",
  rezumat: "Cum se face un buget anual",
  tip: "Ghid",
  subcategorie: { slug: "buget", parinte: { slug: "financiar" } },
};

const all = [fiscal, contract, buget];
const none: BrowseFilters = { categorie: null, subcategorie: null, tip: null, q: null };

const run = (filters: Partial<BrowseFilters>) =>
  all.filter((article) => matchesBrowse(article, { ...none, ...filters })).map((a) => a.titlu);

describe("matchesBrowse", () => {
  it("matches everything with no filters", () => {
    expect(run({})).toHaveLength(3);
  });

  it("a category slug matches every subcategory beneath it", () => {
    expect(run({ categorie: "juridic-fiscal" })).toEqual([
      "Ghid fiscal pentru ONG-uri",
      "Model de contract",
    ]);
  });

  it("a subcategory slug excludes a sibling under the same parent", () => {
    expect(run({ subcategorie: "fiscalitate" })).toEqual(["Ghid fiscal pentru ONG-uri"]);
  });

  it("filters by tip", () => {
    expect(run({ tip: "Ghid" })).toEqual(["Ghid fiscal pentru ONG-uri", "Planificare bugetară"]);
  });

  it("tip matching ignores case", () => {
    expect(run({ tip: "ghid" })).toHaveLength(2);
  });

  it("searches the title", () => {
    expect(run({ q: "contract" })).toEqual(["Model de contract"]);
  });

  it("searches the summary too", () => {
    expect(run({ q: "scutiri" })).toEqual(["Ghid fiscal pentru ONG-uri"]);
  });

  it("search ignores case and diacritics-free input still matches literally", () => {
    expect(run({ q: "GHID FISCAL" })).toEqual(["Ghid fiscal pentru ONG-uri"]);
  });

  it("composes filters — each narrows the last", () => {
    expect(run({ categorie: "juridic-fiscal", tip: "Ghid" })).toEqual([
      "Ghid fiscal pentru ONG-uri",
    ]);
    expect(run({ categorie: "juridic-fiscal", tip: "Ghid", q: "contract" })).toEqual([]);
  });

  it("an article with no subcategory matches only an unfiltered browse", () => {
    const orphan: BrowseArticle = { titlu: "Orfan", subcategorie: null };
    expect(matchesBrowse(orphan, none)).toBe(true);
    expect(matchesBrowse(orphan, { ...none, categorie: "juridic-fiscal" })).toBe(false);
  });
});

describe("distinctTipuri", () => {
  it("lists each tip once, sorted", () => {
    expect(distinctTipuri(all)).toEqual(["Ghid", "Template"]);
  });

  it("omits articles with no tip", () => {
    expect(distinctTipuri([...all, { titlu: "Fără tip", tip: "" }])).toEqual(["Ghid", "Template"]);
  });

  it("treats differing case as one value, keeping the first spelling seen", () => {
    expect(distinctTipuri([{ titlu: "a", tip: "Ghid" }, { titlu: "b", tip: "ghid" }])).toEqual([
      "Ghid",
    ]);
  });
});

describe("browseArticles", () => {
  it("returns the matching articles", () => {
    const { matched } = browseArticles(all, { ...none, categorie: "juridic-fiscal" });
    expect(matched.map((a) => a.titlu)).toEqual([
      "Ghid fiscal pentru ONG-uri",
      "Model de contract",
    ]);
  });

  // The rule this function exists to make testable: the dropdown lists every
  // type in the CATEGORY, so choosing one does not empty the control that chose
  // it. Filtering to "Template" must still offer "Ghid".
  it("lists the category's types regardless of the chosen tip", () => {
    const { matched, tipuri } = browseArticles(all, {
      ...none,
      categorie: "juridic-fiscal",
      tip: "Template",
    });
    expect(matched.map((a) => a.titlu)).toEqual(["Model de contract"]);
    expect(tipuri).toEqual(["Ghid", "Template"]);
  });

  it("does not let the search term shrink the type list either", () => {
    const { matched, tipuri } = browseArticles(all, { ...none, q: "contract" });
    expect(matched).toHaveLength(1);
    expect(tipuri).toEqual(["Ghid", "Template"]);
  });

  it("a subcategory does not narrow the type list either — only the category scopes it", () => {
    const { tipuri } = browseArticles(all, { ...none, subcategorie: "buget" });
    expect(tipuri).toEqual(["Ghid", "Template"]);
  });

  it("scopes the type list to the category, not the whole library", () => {
    const { tipuri } = browseArticles(all, { ...none, categorie: "financiar" });
    expect(tipuri).toEqual(["Ghid"]);
  });

  // The stranding this fix is about: "fiscalitate" holds only "Ghid", so a
  // subcategory-scoped list would drop "Template" and blank a `tip=Template`
  // select. The list stays the category's.
  it("keeps the other types of the category when a one-type subcategory is chosen", () => {
    const { tipuri } = browseArticles(all, {
      ...none,
      categorie: "juridic-fiscal",
      subcategorie: "fiscalitate",
    });
    expect(tipuri).toEqual(["Ghid", "Template"]);
  });

  it("still narrows the results by subcategory — the fix changes the type list only", () => {
    const { matched, tipuri } = browseArticles(all, {
      ...none,
      categorie: "juridic-fiscal",
      subcategorie: "contracte",
    });
    expect(matched.map((a) => a.titlu)).toEqual(["Model de contract"]);
    expect(tipuri).toEqual(["Ghid", "Template"]);
  });
});
