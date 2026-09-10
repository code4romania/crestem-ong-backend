import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Fotografii eveniment")).toBe("fotografii-eveniment");
  });

  it("collapses runs of non-alphanumerics to a single hyphen", () => {
    expect(slugify("Logo  &  branding")).toBe("logo-branding");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  Rapoarte 2026!  ")).toBe("rapoarte-2026");
  });

  it("folds diacritics to ASCII, Romanian included", () => {
    expect(slugify("Ședințe câmp țărănesc")).toBe("sedinte-camp-taranesc");
    expect(slugify("Café Résumé")).toBe("cafe-resume");
  });

  it("returns an empty string when there is nothing slug-able", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("keeps digits", () => {
    expect(slugify("Buget 2025 2026")).toBe("buget-2025-2026");
  });
});
