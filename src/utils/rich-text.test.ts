import { describe, expect, it } from "vitest";
import { stripHtml } from "./rich-text";

describe("stripHtml", () => {
  it("removes tags, leaving only the visible text", () => {
    expect(stripHtml("<p>Bună <strong>ziua</strong></p>")).toBe("Bună ziua");
  });

  it("does not count markup towards length", () => {
    const html = "<p>" + "a".repeat(999) + "</p>";
    expect(stripHtml(html).length).toBe(999);
  });

  it("leaves plain text (no markup) unchanged", () => {
    expect(stripHtml("Bună ziua")).toBe("Bună ziua");
  });
});
