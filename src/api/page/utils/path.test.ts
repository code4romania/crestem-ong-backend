import { describe, expect, it } from "vitest";
import { ancestorDocumentIds, pagePath, pathSegments } from "./path";

describe("pagePath", () => {
  it("returns a root page at the top level", () => {
    expect(pagePath({ slug: "despre-noi" })).toBe("/despre-noi");
  });

  it("prefixes a child with its parent", () => {
    const page = { slug: "social-change-accelerator", parinte: { slug: "programe" } };
    expect(pagePath(page)).toBe("/programe/social-change-accelerator");
  });

  it("walks the whole ancestor chain", () => {
    const page = {
      slug: "aplicare",
      parinte: { slug: "accelerator", parinte: { slug: "programe" } },
    };
    expect(pagePath(page)).toBe("/programe/accelerator/aplicare");
  });

  it("treats a null parent as no parent", () => {
    expect(pagePath({ slug: "contact", parinte: null })).toBe("/contact");
  });

  it("stops instead of looping when the stored chain is cyclic", () => {
    const parent: any = { documentId: "p", slug: "programe" };
    const child: any = { documentId: "c", slug: "accelerator", parinte: parent };
    parent.parinte = child;

    expect(pagePath(child)).toBe("/programe/accelerator");
  });
});

describe("pathSegments", () => {
  it("counts a root page as one segment", () => {
    expect(pathSegments({ slug: "programe" })).toEqual(["programe"]);
  });

  it("orders segments from the root down", () => {
    const page = { slug: "aplicare", parinte: { slug: "accelerator", parinte: { slug: "programe" } } };
    expect(pathSegments(page)).toEqual(["programe", "accelerator", "aplicare"]);
  });
});

describe("ancestorDocumentIds", () => {
  it("is empty for a root page", () => {
    expect(ancestorDocumentIds({ documentId: "a", slug: "programe" })).toEqual([]);
  });

  it("lists every ancestor, nearest first", () => {
    const page = {
      documentId: "c",
      slug: "aplicare",
      parinte: {
        documentId: "b",
        slug: "accelerator",
        parinte: { documentId: "a", slug: "programe" },
      },
    };
    expect(ancestorDocumentIds(page)).toEqual(["b", "a"]);
  });
});
