import { describe, expect, it } from "vitest";
import { buildTree, checkParent, findByPath, type PageRow } from "./tree";

/** programe > accelerator > aplicare, plus a stand-alone contact page. */
const rows: PageRow[] = [
  { documentId: "programe", slug: "programe", parinte: null },
  { documentId: "accel", slug: "social-change-accelerator", parinte: "programe" },
  { documentId: "aplicare", slug: "aplicare", parinte: "accel" },
  { documentId: "contact", slug: "contact", parinte: null },
];

describe("buildTree", () => {
  it("links a row to its parent so the path can be walked", () => {
    const nodes = buildTree(rows);
    expect(nodes.get("aplicare")?.parinte?.slug).toBe("social-change-accelerator");
  });

  it("leaves a root page without a parent", () => {
    expect(buildTree(rows).get("programe")?.parinte).toBeNull();
  });
});

describe("checkParent", () => {
  it("accepts a page moving under an unrelated root", () => {
    expect(checkParent({ pageId: "contact", parentId: "programe", rows })).toBeNull();
  });

  it("accepts a new page under an existing parent", () => {
    expect(checkParent({ pageId: null, parentId: "accel", rows })).toBeNull();
  });

  it("accepts no parent at all", () => {
    expect(checkParent({ pageId: "accel", parentId: null, rows })).toBeNull();
  });

  it("rejects a parent that does not exist", () => {
    expect(checkParent({ pageId: "contact", parentId: "fantoma", rows })).toBe(
      "Pagina părinte nu există",
    );
  });

  it("rejects a page set as its own parent", () => {
    expect(checkParent({ pageId: "accel", parentId: "accel", rows })).toBe(
      "O pagină nu poate fi propria subpagină",
    );
  });

  it("rejects a parent that sits below the page", () => {
    expect(checkParent({ pageId: "programe", parentId: "aplicare", rows })).toBe(
      "O pagină nu poate fi propria subpagină",
    );
  });

  it("rejects a move that would push the page past four levels", () => {
    const deep: PageRow[] = [
      ...rows,
      { documentId: "formular", slug: "formular", parinte: "aplicare" },
    ];
    expect(checkParent({ pageId: "contact", parentId: "formular", rows: deep })).toBe(
      "Calea paginii nu poate depăși 4 niveluri",
    );
  });

  it("rejects a move that would push the page's own subpages past four levels", () => {
    // `programe` carries three levels below it, so it cannot sit under
    // `contact` without pushing `formular` to a fifth segment.
    const deep: PageRow[] = [
      ...rows,
      { documentId: "formular", slug: "formular", parinte: "aplicare" },
    ];
    expect(checkParent({ pageId: "programe", parentId: "contact", rows: deep })).toBe(
      "Calea paginii nu poate depăși 4 niveluri",
    );
  });
});

describe("findByPath", () => {
  it("finds a top-level page", () => {
    expect(findByPath(rows, "/contact")).toBe("contact");
  });

  it("finds a nested page by its full path", () => {
    expect(findByPath(rows, "/programe/social-change-accelerator")).toBe("accel");
  });

  it("does not find a nested page by its slug alone", () => {
    expect(findByPath(rows, "/social-change-accelerator")).toBeNull();
  });

  it("does not find a page under the wrong parent", () => {
    expect(findByPath(rows, "/contact/social-change-accelerator")).toBeNull();
  });

  it("returns null for a path that matches nothing", () => {
    expect(findByPath(rows, "/inexistent")).toBeNull();
  });

  it("reads a path with no leading slash the same way", () => {
    expect(findByPath(rows, "programe/social-change-accelerator")).toBe("accel");
  });
});
