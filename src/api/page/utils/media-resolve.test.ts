import { describe, expect, it } from "vitest";
import { applyResolvedMedia, type ResolvedFile } from "./media-resolve";

const files = new Map<number, ResolvedFile>([
  [1, { url: "/uploads/new_logo.png", name: "new_logo.png", alternativeText: "Sigla nouă" }],
]);

describe("applyResolvedMedia", () => {
  it("refreshes url, name and alt on a matching file node", () => {
    const blocks = [
      {
        id: "b1",
        type: "image",
        data: { image: { id: 1, url: "/uploads/old_logo.png", name: "old_logo.png" }, altText: "x" },
      },
    ];
    const out = applyResolvedMedia(blocks, files) as any;
    expect(out[0].data.image).toEqual({
      id: 1,
      url: "/uploads/new_logo.png",
      name: "new_logo.png",
      alternativeText: "Sigla nouă",
    });
  });

  it("nulls a file node whose id is gone (object key position)", () => {
    const blocks = [
      { id: "b1", type: "image", data: { image: { id: 99, url: "/uploads/gone.png", name: "gone.png" } } },
    ];
    const out = applyResolvedMedia(blocks, files) as any;
    expect(out[0].data.image).toBeNull();
  });

  it("drops a gone file node from an array (gallery)", () => {
    const blocks = [
      {
        id: "g",
        type: "gallery",
        data: {
          imagini: [
            { id: 1, url: "/old1.png", name: "1" },
            { id: 99, url: "/old2.png", name: "2" },
          ],
        },
      },
    ];
    const out = applyResolvedMedia(blocks, files) as any;
    expect(out[0].data.imagini).toHaveLength(1);
    expect(out[0].data.imagini[0].url).toBe("/uploads/new_logo.png");
  });

  it("recurses into section and columns children", () => {
    const blocks = [
      {
        id: "s",
        type: "section",
        data: {
          blocuri: [
            {
              id: "c",
              type: "columns",
              data: {
                coloane: [
                  { blocuri: [{ id: "i", type: "image", data: { image: { id: 1, url: "/o.png", name: "o" } } }] },
                ],
              },
            },
          ],
        },
      },
    ];
    const out = applyResolvedMedia(blocks, files) as any;
    expect(out[0].data.blocuri[0].data.coloane[0].blocuri[0].data.image.url).toBe("/uploads/new_logo.png");
  });

  it("leaves a non-file {id} node (person ref) untouched", () => {
    const blocks = [{ id: "p", type: "people-grid", data: { pagina: "doc9", persoane: [{ id: 5 }] } }];
    const out = applyResolvedMedia(blocks, files) as any;
    expect(out[0].data.persoane[0]).toEqual({ id: 5 });
    expect(out[0].data.pagina).toBe("doc9");
  });

  it("does not mutate the input", () => {
    const blocks = [{ id: "b1", type: "image", data: { image: { id: 1, url: "/old.png", name: "old" } } }];
    const snapshot = JSON.stringify(blocks);
    applyResolvedMedia(blocks, files);
    expect(JSON.stringify(blocks)).toBe(snapshot);
  });
});
