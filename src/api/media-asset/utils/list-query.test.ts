import { describe, expect, it } from "vitest";
import { buildAssetFilters } from "./list-query";

const NONE = { search: "", tip: "", slugs: [] as string[] };

describe("buildAssetFilters", () => {
  it("returns {} when no filter is set", () => {
    expect(buildAssetFilters(NONE)).toEqual({});
  });

  it("builds a case-insensitive $or search over titlu and fisier.name", () => {
    expect(buildAssetFilters({ ...NONE, search: "logo" })).toEqual({
      $and: [
        {
          $or: [
            { titlu: { $containsi: "logo" } },
            { fisier: { name: { $containsi: "logo" } } },
          ],
        },
      ],
    });
  });

  it("filters tip=image on mime $startsWith image/", () => {
    expect(buildAssetFilters({ ...NONE, tip: "image" })).toEqual({
      $and: [{ fisier: { mime: { $startsWith: "image/" } } }],
    });
  });

  it("filters tip=video on mime $startsWith video/", () => {
    expect(buildAssetFilters({ ...NONE, tip: "video" })).toEqual({
      $and: [{ fisier: { mime: { $startsWith: "video/" } } }],
    });
  });

  it("filters tip=file on null mime OR neither image nor video", () => {
    expect(buildAssetFilters({ ...NONE, tip: "file" })).toEqual({
      $and: [
        {
          $or: [
            { fisier: { mime: { $null: true } } },
            {
              $and: [
                { fisier: { mime: { $notContains: "image/" } } },
                { fisier: { mime: { $notContains: "video/" } } },
              ],
            },
          ],
        },
      ],
    });
  });

  it("includes the null-mime branch in the tip=file filter", () => {
    const filters = buildAssetFilters({ ...NONE, tip: "file" }) as {
      $and: { $or: unknown[] }[];
    };
    expect(filters.$and[0].$or).toContainEqual({
      fisier: { mime: { $null: true } },
    });
  });

  it("filters by etichete slugs with $in", () => {
    expect(buildAssetFilters({ ...NONE, slugs: ["foto", "brand"] })).toEqual({
      $and: [{ etichete: { slug: { $in: ["foto", "brand"] } } }],
    });
  });

  it("combines search, tip and slugs under a single $and", () => {
    const result = buildAssetFilters({
      search: "raport",
      tip: "image",
      slugs: ["foto"],
    }) as { $and: unknown[] };
    expect(result.$and).toHaveLength(3);
    expect(result.$and).toEqual([
      {
        $or: [
          { titlu: { $containsi: "raport" } },
          { fisier: { name: { $containsi: "raport" } } },
        ],
      },
      { fisier: { mime: { $startsWith: "image/" } } },
      { etichete: { slug: { $in: ["foto"] } } },
    ]);
  });
});
