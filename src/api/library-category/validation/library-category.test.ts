import { describe, expect, it } from "vitest";
import { createCategorySchema, updateCategorySchema } from "./library-category";

const valid = { nume: "Juridic & Fiscal", slug: "juridic-fiscal", parinte: null };

describe("createCategorySchema", () => {
  it("accepts a top-level category", () => {
    expect(createCategorySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a subcategory", () => {
    expect(
      createCategorySchema.safeParse({ ...valid, parinte: "abc123" }).success,
    ).toBe(true);
  });

  it("defaults a missing parent to null", () => {
    const parsed = createCategorySchema.safeParse({ nume: "Leadership", slug: "leadership" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.parinte).toBeNull();
  });

  it("rejects a blank name", () => {
    expect(createCategorySchema.safeParse({ ...valid, nume: "   " }).success).toBe(false);
  });

  it("rejects a slug that is not url-safe", () => {
    expect(createCategorySchema.safeParse({ ...valid, slug: "Juridic Fiscal" }).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(
      createCategorySchema.safeParse({ ...valid, ordine: 3 }).success,
    ).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("accepts a rename on its own", () => {
    expect(updateCategorySchema.safeParse({ nume: "Juridic" }).success).toBe(true);
  });

  it("accepts an empty payload", () => {
    expect(updateCategorySchema.safeParse({}).success).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(updateCategorySchema.safeParse({ nume: "" }).success).toBe(false);
  });
});

describe("descriere and icon", () => {
  it("defaults both when absent on create", () => {
    const parsed = createCategorySchema.safeParse({ nume: "Leadership", slug: "leadership" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.descriere).toBe("");
    expect(parsed.success && parsed.data.icon).toBe("folder");
  });

  it("accepts a known icon key", () => {
    expect(
      createCategorySchema.safeParse({
        nume: "Juridic",
        slug: "juridic",
        icon: "scale",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown icon key", () => {
    expect(
      createCategorySchema.safeParse({ nume: "Juridic", slug: "juridic", icon: "rocket" })
        .success,
    ).toBe(false);
  });

  it("rejects a description past the cap", () => {
    expect(
      createCategorySchema.safeParse({
        nume: "Juridic",
        slug: "juridic",
        descriere: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  // The zod-4 trap: `.default().optional()` still emits the default for an
  // absent key, which would blank a description on any partial update.
  it("leaves an absent descriere absent on update", () => {
    const parsed = updateCategorySchema.safeParse({ nume: "Nume nou" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "descriere" in parsed.data).toBe(false);
    expect(parsed.success && "icon" in parsed.data).toBe(false);
  });

  it("still allows clearing the description deliberately", () => {
    const parsed = updateCategorySchema.safeParse({ descriere: "" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.descriere).toBe("");
  });
});
