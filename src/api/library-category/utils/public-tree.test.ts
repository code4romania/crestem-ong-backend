import { describe, expect, it } from "vitest";
import { buildPublicCategories } from "./public-tree";

const juridic = { documentId: "cat-juridic", nume: "Juridic & Fiscal", slug: "juridic-fiscal", descriere: "Acte și taxe", icon: "scale", parinte: null };
const financiar = { documentId: "cat-financiar", nume: "Finanțări", slug: "finantari", descriere: "", icon: "trending", parinte: null };
const gol = { documentId: "cat-gol", nume: "Gol", slug: "gol", descriere: "", icon: "folder", parinte: null };

const fiscalitate = { documentId: "sub-fiscal", nume: "Fiscalitate", slug: "fiscalitate", descriere: "TVA", parinte: juridic };
const contracte = { documentId: "sub-contracte", nume: "Contracte", slug: "contracte", descriere: "", parinte: juridic };
const buget = { documentId: "sub-buget", nume: "Buget", slug: "buget", descriere: "", parinte: financiar };

const rows = [juridic, financiar, gol, fiscalitate, contracte, buget];

describe("buildPublicCategories", () => {
  it("nests subcategories under their parent and sums the counts", () => {
    const tree = buildPublicCategories(rows, new Map([["sub-fiscal", 2], ["sub-contracte", 3]]));
    expect(tree).toHaveLength(1);
    expect(tree[0].slug).toBe("juridic-fiscal");
    expect(tree[0].numarArticole).toBe(5);
    expect(tree[0].copii.map((child) => child.slug)).toEqual(["fiscalitate", "contracte"]);
  });

  it("omits a subcategory with nothing visible in it", () => {
    // Otherwise the public filter dropdown would offer an option guaranteed to
    // return no results.
    const tree = buildPublicCategories(rows, new Map([["sub-fiscal", 2]]));
    expect(tree[0].copii.map((child) => child.slug)).toEqual(["fiscalitate"]);
  });

  it("omits a category once every subcategory beneath it is empty", () => {
    const tree = buildPublicCategories(rows, new Map([["sub-buget", 1]]));
    expect(tree.map((category) => category.slug)).toEqual(["finantari"]);
  });

  it("omits a category that has no subcategories at all", () => {
    const tree = buildPublicCategories(rows, new Map([["sub-fiscal", 1]]));
    expect(tree.map((category) => category.slug)).not.toContain("gol");
  });

  it("returns nothing when no article is visible anywhere", () => {
    expect(buildPublicCategories(rows, new Map())).toEqual([]);
  });

  it("carries descriere and icon on a category, and descriere on a subcategory", () => {
    const [category] = buildPublicCategories(rows, new Map([["sub-fiscal", 1]]));
    expect(category.descriere).toBe("Acte și taxe");
    expect(category.icon).toBe("scale");
    expect(category.copii[0].descriere).toBe("TVA");
  });

  it("falls back for a row saved before descriere and icon existed", () => {
    const legacy = { documentId: "cat-x", nume: "Vechi", slug: "vechi", parinte: null };
    const child = { documentId: "sub-x", nume: "Sub", slug: "sub", parinte: legacy };
    const [category] = buildPublicCategories([legacy, child], new Map([["sub-x", 1]]));
    expect(category.descriere).toBe("");
    expect(category.icon).toBe("folder");
    expect(category.copii[0].descriere).toBe("");
  });

  it("gives a subcategory no icon — only categories render one", () => {
    const [category] = buildPublicCategories(rows, new Map([["sub-fiscal", 1]]));
    expect("icon" in category.copii[0]).toBe(false);
  });
});
