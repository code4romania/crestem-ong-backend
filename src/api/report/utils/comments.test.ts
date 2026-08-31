import { describe, expect, it } from "vitest";
import { collectAnonymousComments } from "./comments";

describe("collectAnonymousComments", () => {
  it("groups the arguments of every respondent by dimension", () => {
    const comments = collectAnonymousComments([
      {
        user: { nume: "Ana Pop" },
        dimensions: [
          { dimensionKey: "guvernanta", submitted: true, comment: "Ana despre guvernanță" },
          { dimensionKey: "leadership", submitted: true, comment: "Ana despre leadership" },
        ],
      },
      {
        user: { nume: "Ion Ionescu" },
        dimensions: [
          { dimensionKey: "guvernanta", submitted: true, comment: "Ion despre guvernanță" },
        ],
      },
    ]);

    expect(comments).toEqual({
      guvernanta: [
        { author: null, text: "Ana despre guvernanță" },
        { author: null, text: "Ion despre guvernanță" },
      ],
      leadership: [{ author: null, text: "Ana despre leadership" }],
    });
  });

  it("never attributes an argument, even though the name is populated", () => {
    const comments = collectAnonymousComments([
      {
        user: { nume: "Ana Pop" },
        dimensions: [
          { dimensionKey: "guvernanta", submitted: true, comment: "Text" },
        ],
      },
    ]);

    expect(comments.guvernanta[0].author).toBeNull();
  });

  it("skips drafts and blank arguments", () => {
    const comments = collectAnonymousComments([
      {
        dimensions: [
          { dimensionKey: "guvernanta", submitted: false, comment: "Draft" },
          { dimensionKey: "leadership", submitted: true, comment: "   " },
          { dimensionKey: "leadership", submitted: true, comment: null },
        ],
      },
    ]);

    expect(comments).toEqual({});
  });

  it("returns an empty map when nobody was invited", () => {
    expect(collectAnonymousComments([])).toEqual({});
  });
});
