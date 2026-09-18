import { describe, expect, it } from "vitest";
import { checkRelatedArticles } from "./article";

describe("checkRelatedArticles", () => {
  it("returns null without querying when there are no ids", async () => {
    let called = false;
    (globalThis as any).strapi = {
      documents: () => ({
        findMany: async () => {
          called = true;
          return [];
        },
      }),
    };

    const result = await checkRelatedArticles((globalThis as any).strapi, []);

    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it("returns null when every id is found", async () => {
    (globalThis as any).strapi = {
      documents: () => ({
        findMany: async () => [{ documentId: "a1" }, { documentId: "b2" }],
      }),
    };

    const result = await checkRelatedArticles((globalThis as any).strapi, ["a1", "b2"]);

    expect(result).toBeNull();
  });

  it("returns the Romanian error when some ids are missing", async () => {
    (globalThis as any).strapi = {
      documents: () => ({
        findMany: async () => [{ documentId: "a1" }],
      }),
    };

    const result = await checkRelatedArticles((globalThis as any).strapi, ["a1", "not-real"]);

    expect(result).toBe("Unul dintre articolele relaționate nu există");
  });

  it("returns null for a duplicate real id, instead of a false-positive error", async () => {
    (globalThis as any).strapi = {
      documents: () => ({
        // `$in` collapses the duplicate, so a real backend returns one row
        // for the two repeated ids.
        findMany: async () => [{ documentId: "a1" }],
      }),
    };

    const result = await checkRelatedArticles((globalThis as any).strapi, ["a1", "a1"]);

    expect(result).toBeNull();
  });
});
