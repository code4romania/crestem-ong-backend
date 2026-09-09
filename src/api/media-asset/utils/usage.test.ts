import { describe, expect, it, vi } from "vitest";

vi.mock("../../page/utils/page-index", () => ({
  loadPageIndex: async () => ({
    pathOf: (p: { documentId: string; slug: string }) =>
      p.documentId === "p1" ? "/despre-noi" : `/${p.slug}`,
  }),
}));

import { findPagesUsingFile } from "./usage";

const strapiWith = (pages: any[]) => ({
  documents: () => ({
    findMany: vi.fn().mockResolvedValue(pages),
  }),
});

describe("findPagesUsingFile", () => {
  it("returns each page using the file with its resolved path", async () => {
    const strapi = strapiWith([
      { documentId: "p1", slug: "despre-noi", titlu: "Despre noi" },
      { documentId: "p2", slug: "contact", titlu: "Contact" },
    ]);
    const result = await findPagesUsingFile(strapi, 42);
    expect(result).toEqual([
      { documentId: "p1", titlu: "Despre noi", cale: "/despre-noi" },
      { documentId: "p2", titlu: "Contact", cale: "/contact" },
    ]);
  });

  it("returns an empty array when no page uses the file", async () => {
    expect(await findPagesUsingFile(strapiWith([]), 99)).toEqual([]);
  });

  it("filters pages by the fisiere relation and the given file id", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const strapi = { documents: () => ({ findMany }) };
    await findPagesUsingFile(strapi, 7);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ filters: { fisiere: { id: { $in: [7] } } } }),
    );
  });
});
