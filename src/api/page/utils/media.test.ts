import { describe, expect, it } from "vitest";
import { collectFileIds } from "./media";

describe("collectFileIds", () => {
  it("finds a file on a top-level block", () => {
    const blocks = [
      { id: "a", type: "image", data: { imagine: { id: 7, url: "/uploads/a.png" } } },
    ];
    expect(collectFileIds(blocks)).toEqual([7]);
  });

  it("finds files nested in a section", () => {
    const blocks = [
      {
        id: "s",
        type: "section",
        data: {
          imagine: { id: 1, url: "/uploads/bg.png" },
          blocuri: [
            { id: "c", type: "image", data: { imagine: { id: 2, url: "/uploads/c.png" } } },
          ],
        },
      },
    ];
    expect(collectFileIds(blocks).sort()).toEqual([1, 2]);
  });

  it("finds files inside a gallery list", () => {
    const blocks = [
      {
        id: "g",
        type: "gallery",
        data: {
          imagini: [
            { imagine: { id: 3, url: "/uploads/1.png" } },
            { imagine: { id: 4, url: "/uploads/2.png" } },
          ],
        },
      },
    ];
    expect(collectFileIds(blocks).sort()).toEqual([3, 4]);
  });

  it("returns each id once", () => {
    const blocks = [
      { id: "a", type: "image", data: { imagine: { id: 9, url: "/uploads/a.png" } } },
      { id: "b", type: "image", data: { imagine: { id: 9, url: "/uploads/a.png" } } },
    ];
    expect(collectFileIds(blocks)).toEqual([9]);
  });

  it("ignores objects that merely have a numeric id", () => {
    const blocks = [
      { id: "a", type: "people-grid", data: { persoane: [{ id: 12, nume: "Ana" }] } },
    ];
    expect(collectFileIds(blocks)).toEqual([]);
  });

  it("returns nothing for an empty page", () => {
    expect(collectFileIds([])).toEqual([]);
  });
});
