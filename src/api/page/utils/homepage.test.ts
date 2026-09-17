import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_EMPTY_ERROR,
  HOMEPAGE_IMMUTABLE_ERROR,
  homepageUpdateError,
  isHomepage,
} from "./homepage";

const homepage = {
  documentId: "home-1",
  slug: "homepage",
  esteHomepage: true,
  vizibilitate: ["public"],
  parinte: null,
};

const block = { id: "b1", type: "rich-text", data: {} };

describe("isHomepage", () => {
  it("is false for an ordinary page, and for nothing at all", () => {
    expect(isHomepage({ esteHomepage: false })).toBe(false);
    expect(isHomepage(null)).toBe(false);
  });

  it("is true for the flagged row", () => {
    expect(isHomepage(homepage)).toBe(true);
  });
});

describe("homepageUpdateError", () => {
  it("allows a title and block edit", () => {
    expect(homepageUpdateError(homepage, { titlu: "Acasă", blocuri: [block] })).toBeNull();
  });

  it("refuses an empty block list", () => {
    expect(homepageUpdateError(homepage, { blocuri: [] })).toBe(HOMEPAGE_EMPTY_ERROR);
  });

  it("leaves an absent block list alone", () => {
    expect(homepageUpdateError(homepage, { titlu: "Acasă" })).toBeNull();
  });

  it("refuses a different slug", () => {
    expect(homepageUpdateError(homepage, { slug: "acasa" })).toBe(HOMEPAGE_IMMUTABLE_ERROR);
  });

  it("accepts the slug it already has", () => {
    expect(homepageUpdateError(homepage, { slug: "homepage" })).toBeNull();
  });

  it("refuses a parent", () => {
    expect(homepageUpdateError(homepage, { parinte: "p-1" })).toBe(HOMEPAGE_IMMUTABLE_ERROR);
  });

  it("accepts an explicit null parent, which is where it already is", () => {
    expect(homepageUpdateError(homepage, { parinte: null })).toBeNull();
  });

  it("refuses narrowed visibility", () => {
    expect(homepageUpdateError(homepage, { vizibilitate: ["fdsc"] })).toBe(
      HOMEPAGE_IMMUTABLE_ERROR,
    );
  });

  it("accepts the visibility it already has", () => {
    expect(homepageUpdateError(homepage, { vizibilitate: ["public"] })).toBeNull();
  });

  it("says nothing about an ordinary page", () => {
    expect(
      homepageUpdateError({ ...homepage, esteHomepage: false }, { slug: "altceva", blocuri: [] }),
    ).toBeNull();
  });
});
