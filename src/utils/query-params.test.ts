import { describe, expect, it } from "vitest";
import { csvParam, pageParam, textParam } from "./query-params";

describe("textParam", () => {
  it("trims a string value", () => {
    expect(textParam("  ana@example.org ")).toBe("ana@example.org");
  });

  it("is empty for anything that is not a string", () => {
    expect(textParam(undefined)).toBe("");
    expect(textParam(["a", "b"])).toBe("");
  });
});

describe("csvParam", () => {
  it("splits the comma-separated ids a multi-select sends", () => {
    expect(csvParam("ong-1,ong-2")).toEqual(["ong-1", "ong-2"]);
  });

  it("drops blanks and duplicates left by editing the selection", () => {
    expect(csvParam("ong-1, ,ong-1,ong-2,")).toEqual(["ong-1", "ong-2"]);
  });

  it("is empty when nothing is selected", () => {
    expect(csvParam(undefined)).toEqual([]);
    expect(csvParam("")).toEqual([]);
  });

  it("accepts the repeated-key form a query string can also take", () => {
    expect(csvParam(["ong-1", "ong-2"])).toEqual(["ong-1", "ong-2"]);
  });
});

describe("pageParam", () => {
  it("reads a positive page", () => {
    expect(pageParam("3")).toBe(3);
  });

  it("falls back to the first page for anything else", () => {
    expect(pageParam(undefined)).toBe(1);
    expect(pageParam("0")).toBe(1);
    expect(pageParam("-2")).toBe(1);
    expect(pageParam("abc")).toBe(1);
    expect(pageParam("2.5")).toBe(1);
  });
});
