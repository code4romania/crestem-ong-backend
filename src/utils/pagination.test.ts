import { describe, expect, it } from "vitest";
import { pageSlice } from "./pagination";

describe("pageSlice", () => {
  it("starts the first page at the beginning", () => {
    expect(pageSlice(1, 20)).toEqual({ limit: 20, start: 0 });
  });

  it("skips the pages before the one asked for", () => {
    expect(pageSlice(3, 20)).toEqual({ limit: 20, start: 40 });
  });

  it("treats a page below one as the first page", () => {
    expect(pageSlice(0, 20)).toEqual({ limit: 20, start: 0 });
    expect(pageSlice(-2, 20)).toEqual({ limit: 20, start: 0 });
  });
});
