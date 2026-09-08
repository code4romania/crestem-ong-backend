import { describe, expect, it } from "vitest";
import { createPageSchema, updatePageSchema } from "./page";

const valid = {
  titlu: "Despre noi",
  slug: "despre",
  vizibilitate: ["public"],
  blocuri: [
    { id: "a1", type: "rich-text", data: { continut: "<p>Salut</p>" } },
  ],
};

describe("createPageSchema", () => {
  it("accepts a page with one block", () => {
    expect(createPageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a page with no blocks at all", () => {
    expect(createPageSchema.safeParse({ ...valid, blocuri: [] }).success).toBe(true);
  });

  it("rejects a blank title", () => {
    expect(createPageSchema.safeParse({ ...valid, titlu: "  " }).success).toBe(false);
  });

  it("rejects a reserved slug", () => {
    expect(createPageSchema.safeParse({ ...valid, slug: "dashboard" }).success).toBe(false);
  });

  it("rejects a slug that is not url-safe", () => {
    expect(createPageSchema.safeParse({ ...valid, slug: "Despre Noi" }).success).toBe(false);
  });

  it("rejects an empty visibility list", () => {
    expect(createPageSchema.safeParse({ ...valid, vizibilitate: [] }).success).toBe(false);
  });

  it("rejects an unknown audience", () => {
    expect(
      createPageSchema.safeParse({ ...valid, vizibilitate: ["everyone"] }).success,
    ).toBe(false);
  });

  it("rejects an unknown block type", () => {
    const parsed = createPageSchema.safeParse({
      ...valid,
      blocuri: [{ id: "a1", type: "teleporter", data: {} }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate block ids in the same list", () => {
    const parsed = createPageSchema.safeParse({
      ...valid,
      blocuri: [
        { id: "a1", type: "spacer", data: {} },
        { id: "a1", type: "divider", data: {} },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts blocks nested inside a section", () => {
    const parsed = createPageSchema.safeParse({
      ...valid,
      blocuri: [
        {
          id: "s1",
          type: "section",
          data: { blocuri: [{ id: "c1", type: "quote", data: {} }] },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown block type nested inside a section", () => {
    const parsed = createPageSchema.safeParse({
      ...valid,
      blocuri: [
        {
          id: "s1",
          type: "section",
          data: { blocuri: [{ id: "c1", type: "teleporter", data: {} }] },
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts blocks nested inside columns", () => {
    const parsed = createPageSchema.safeParse({
      ...valid,
      blocuri: [
        {
          id: "k1",
          type: "columns",
          data: {
            coloane: [
              { blocuri: [{ id: "c1", type: "image", data: {} }] },
              { blocuri: [{ id: "c2", type: "rich-text", data: {} }] },
            ],
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a block tree over the size cap", () => {
    const parsed = createPageSchema.safeParse({
      ...valid,
      blocuri: [
        { id: "a1", type: "rich-text", data: { continut: "x".repeat(1_100_000) } },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("parinte", () => {
  it("accepts a page created under a parent", () => {
    expect(createPageSchema.safeParse({ ...valid, parinte: "abc123" }).success).toBe(true);
  });

  it("accepts a page created without one", () => {
    expect(createPageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts null as an explicit move back to the top level", () => {
    expect(updatePageSchema.safeParse({ parinte: null }).success).toBe(true);
  });

  it("rejects a blank parent reference", () => {
    expect(createPageSchema.safeParse({ ...valid, parinte: "   " }).success).toBe(false);
  });
});
