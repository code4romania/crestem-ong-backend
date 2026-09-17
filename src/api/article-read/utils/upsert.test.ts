import { describe, expect, it, vi } from "vitest";
import { upsertArticleRead } from "./upsert";

describe("upsertArticleRead", () => {
  it("creates a row when the user has not read this article before", async () => {
    const create = vi.fn().mockResolvedValue({ documentId: "read-1" });
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const strapi = { documents: () => ({ findFirst, create, update }) };

    await upsertArticleRead(strapi, "user-1", "article-1");

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        user: { connect: ["user-1"] },
        article: { connect: ["article-1"] },
      }),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates the existing row's accessedAt on a repeat read instead of creating another", async () => {
    const update = vi.fn().mockResolvedValue({ documentId: "read-1" });
    const findFirst = vi.fn().mockResolvedValue({ documentId: "read-1" });
    const create = vi.fn();
    const strapi = { documents: () => ({ findFirst, create, update }) };

    await upsertArticleRead(strapi, "user-1", "article-1");

    expect(update).toHaveBeenCalledWith({
      documentId: "read-1",
      data: expect.objectContaining({ accessedAt: expect.any(String) }),
    });
    expect(create).not.toHaveBeenCalled();
  });
});
