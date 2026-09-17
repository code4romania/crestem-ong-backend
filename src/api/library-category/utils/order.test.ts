import { describe, expect, it } from "vitest";
import { byCategoryOrder } from "./order";

describe("byCategoryOrder", () => {
  it("sorts matrix categories by dimension order, not alphabetically", () => {
    const slugs = [
      "comunicare-externa",
      "guvernanta",
      "leadership",
      "aspecte-financiare",
    ];
    expect([...slugs].sort((a, b) => byCategoryOrder({ slug: a }, { slug: b }))).toEqual([
      "guvernanta",
      "aspecte-financiare",
      "leadership",
      "comunicare-externa",
    ]);
  });

  it("sorts every matched category before any unmatched one", () => {
    const rows = [{ slug: "necunoscuta" }, { slug: "leadership" }];
    expect(rows.sort(byCategoryOrder).map((row) => row.slug)).toEqual([
      "leadership",
      "necunoscuta",
    ]);
  });

  it("leaves unmatched categories in their given order", () => {
    const rows = [{ slug: "gol" }, { slug: "finantari" }, { slug: "juridic-fiscal" }];
    expect(rows.sort(byCategoryOrder).map((row) => row.slug)).toEqual([
      "gol",
      "finantari",
      "juridic-fiscal",
    ]);
  });
});
