import { describe, expect, it } from "vitest";
import { applyCategoryBlocks, hasCategoryBlock, type ResolvedCategory } from "./blocks";

const blocks = [
  { id: "b1", type: "article-grid", data: { titlu: "Explorează", coloane: "3" } },
  {
    id: "b2",
    type: "section",
    data: {
      blocuri: [{ id: "b3", type: "article-grid", data: { coloane: "2" } }],
    },
  },
  { id: "b4", type: "rich-text", data: { continut: "<p>Salut</p>" } },
];

const card: ResolvedCategory = {
  documentId: "cat-juridic",
  nume: "Juridic & Fiscal",
  slug: "juridic-fiscal",
  descriere: "Acte și taxe",
  icon: "scale",
  numarArticole: 5,
};

describe("hasCategoryBlock", () => {
  it("finds one at the top level", () => {
    expect(hasCategoryBlock([blocks[0]])).toBe(true);
  });

  it("finds one nested inside a container", () => {
    // A block inside a Section or Columns must still be resolved, or it renders
    // empty on the public page while looking fine on the canvas.
    expect(hasCategoryBlock([blocks[1]])).toBe(true);
  });

  it("is false for a tree with no such block, so an ordinary page costs no read", () => {
    expect(hasCategoryBlock([blocks[2]])).toBe(false);
  });
});

describe("applyCategoryBlocks", () => {
  it("injects the same list into every block, nested ones included", () => {
    const result = applyCategoryBlocks(blocks, [card]) as any[];
    expect(result[0].data.categoriiRezolvate).toEqual([card]);
    expect(result[1].data.blocuri[0].data.categoriiRezolvate).toEqual([card]);
  });

  it("injects an empty list rather than leaving the field absent", () => {
    const result = applyCategoryBlocks(blocks, []) as any[];
    expect(result[0].data.categoriiRezolvate).toEqual([]);
  });

  it("leaves blocks of other types untouched", () => {
    const result = applyCategoryBlocks(blocks, [card]) as any[];
    expect(result[2]).toEqual(blocks[2]);
  });

  it("survives a block with no data at all", () => {
    const result = applyCategoryBlocks([{ id: "b9", type: "article-grid" }], [card]) as any[];
    expect(result[0].data.categoriiRezolvate).toEqual([card]);
  });

  it("does not mutate the input", () => {
    applyCategoryBlocks(blocks, [card]);
    expect((blocks[0].data as any).categoriiRezolvate).toBeUndefined();
  });
});
