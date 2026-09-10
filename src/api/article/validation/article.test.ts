import { describe, expect, it } from "vitest";
import { createArticleSchema, updateArticleSchema } from "./article";

const valid = {
  titlu: "Ghid fiscal pentru ONG-uri",
  slug: "ghid-fiscal",
  rezumat: "Navighează prin complexitatea fiscalității pentru ONG-uri.",
  subcategorie: "fiscalitate",
  autor: "Elena Popa",
  etichete: ["fiscal", "taxe"],
  vizibilitate: ["public"],
  blocuri: [{ id: "a1", type: "rich-text", data: { continut: "<p>Salut</p>" } }],
};

describe("createArticleSchema", () => {
  it("accepts a complete article", () => {
    expect(createArticleSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an article with no blocks yet", () => {
    expect(createArticleSchema.safeParse({ ...valid, blocuri: [] }).success).toBe(true);
  });

  it("defaults the optional text fields", () => {
    const parsed = createArticleSchema.safeParse({
      titlu: "Fără extra",
      slug: "fara-extra",
      subcategorie: "fiscalitate",
      vizibilitate: ["public"],
      blocuri: [],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.rezumat).toBe("");
    expect(parsed.success && parsed.data.autor).toBe("");
    expect(parsed.success && parsed.data.etichete).toEqual([]);
  });

  it("rejects a missing subcategory", () => {
    const { subcategorie, ...withoutSubcategory } = valid;
    expect(createArticleSchema.safeParse(withoutSubcategory).success).toBe(false);
  });

  it("rejects a blank subcategory", () => {
    expect(createArticleSchema.safeParse({ ...valid, subcategorie: "  " }).success).toBe(false);
  });

  it("does not apply the page reserved-slug list", () => {
    // An article slug is the fourth segment of a path that already starts with
    // `biblioteca`, so it can never shadow an app route.
    expect(createArticleSchema.safeParse({ ...valid, slug: "dashboard" }).success).toBe(true);
  });

  it("rejects a slug that is not url-safe", () => {
    expect(createArticleSchema.safeParse({ ...valid, slug: "Ghid Fiscal" }).success).toBe(false);
  });

  it("rejects duplicate tags", () => {
    expect(
      createArticleSchema.safeParse({ ...valid, etichete: ["fiscal", "fiscal"] }).success,
    ).toBe(false);
  });

  it("rejects a blank tag", () => {
    expect(createArticleSchema.safeParse({ ...valid, etichete: ["  "] }).success).toBe(false);
  });

  it("rejects an empty visibility list", () => {
    expect(createArticleSchema.safeParse({ ...valid, vizibilitate: [] }).success).toBe(false);
  });

  it("rejects an unknown block type", () => {
    expect(
      createArticleSchema.safeParse({
        ...valid,
        blocuri: [{ id: "a1", type: "teleporter", data: {} }],
      }).success,
    ).toBe(false);
  });

  it("rejects `stare` in the payload", () => {
    // Publishing goes through its own endpoint, so an edit never changes what
    // the public can see.
    expect(createArticleSchema.safeParse({ ...valid, stare: "publicat" }).success).toBe(false);
  });
});

describe("updateArticleSchema", () => {
  it("accepts a partial payload", () => {
    expect(updateArticleSchema.safeParse({ titlu: "Titlu nou" }).success).toBe(true);
  });

  it("accepts an empty payload", () => {
    expect(updateArticleSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a blank subcategory when the field is present", () => {
    expect(updateArticleSchema.safeParse({ subcategorie: "" }).success).toBe(false);
  });

  it("does not fabricate defaults for fields the caller did not send", () => {
    // zod 4's `schema.default(v).optional()` still emits the default when the
    // key is absent, which would make a partial PUT silently blank out every
    // field it did not mention. The parsed output must carry no key at all
    // for anything not in the payload.
    const parsed = updateArticleSchema.safeParse({ titlu: "Titlu nou" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data).toEqual({ titlu: "Titlu nou" });
    expect("rezumat" in parsed.data).toBe(false);
    expect("autor" in parsed.data).toBe(false);
    expect("etichete" in parsed.data).toBe(false);
    expect("blocuri" in parsed.data).toBe(false);
  });

  it("still lets a caller explicitly clear a field", () => {
    const parsed = updateArticleSchema.safeParse({ rezumat: "" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.rezumat).toBe("");
  });

  it("still rejects duplicate tags on the update schema", () => {
    // Proves the uniqueness refine survived the move onto the undefaulted base.
    expect(
      updateArticleSchema.safeParse({ etichete: ["a", "a"] }).success,
    ).toBe(false);
  });
});

describe("tip", () => {
  it("defaults to empty on create", () => {
    const parsed = createArticleSchema.safeParse({
      titlu: "Fără tip",
      slug: "fara-tip",
      subcategorie: "sub",
      vizibilitate: ["public"],
      blocuri: [],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.tip).toBe("");
  });

  it("accepts free text", () => {
    const parsed = createArticleSchema.safeParse({
      titlu: "Template",
      slug: "template",
      subcategorie: "sub",
      tip: "Template",
      vizibilitate: ["public"],
      blocuri: [],
    });
    expect(parsed.success && parsed.data.tip).toBe("Template");
  });

  it("rejects a tip past the cap", () => {
    expect(
      createArticleSchema.safeParse({
        titlu: "T",
        slug: "t",
        subcategorie: "sub",
        tip: "x".repeat(61),
        vizibilitate: ["public"],
        blocuri: [],
      }).success,
    ).toBe(false);
  });

  it("leaves an absent tip absent on update", () => {
    const parsed = updateArticleSchema.safeParse({ titlu: "Titlu nou" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "tip" in parsed.data).toBe(false);
  });
});
