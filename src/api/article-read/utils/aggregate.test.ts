import { describe, expect, it } from "vitest";
import { aggregateOrgLibraryActivity } from "./aggregate";

describe("aggregateOrgLibraryActivity", () => {
  it("counts one access per member and keeps the most recent timestamp", () => {
    const rows = [
      {
        accessedAt: "2026-01-10T10:00:00.000Z",
        article: { documentId: "art-1", titlu: "Ghid A", tip: "Ghid", cale: "/biblioteca/x/y/ghid-a" },
      },
      {
        accessedAt: "2026-02-05T10:00:00.000Z",
        article: { documentId: "art-1", titlu: "Ghid A", tip: "Ghid", cale: "/biblioteca/x/y/ghid-a" },
      },
      {
        accessedAt: "2026-01-20T10:00:00.000Z",
        article: { documentId: "art-2", titlu: "Ghid B", tip: null, cale: null },
      },
    ];

    const result = aggregateOrgLibraryActivity(rows);

    expect(result).toEqual([
      {
        resourceTitle: "Ghid A",
        type: "Ghid",
        accessedAt: "2026-02-05T10:00:00.000Z",
        totalAccesses: 2,
        cale: "/biblioteca/x/y/ghid-a",
      },
      {
        resourceTitle: "Ghid B",
        type: "",
        accessedAt: "2026-01-20T10:00:00.000Z",
        totalAccesses: 1,
        cale: null,
      },
    ]);
  });

  it("ignores reads whose article relation is missing", () => {
    const rows = [{ accessedAt: "2026-01-10T10:00:00.000Z", article: null }];
    expect(aggregateOrgLibraryActivity(rows)).toEqual([]);
  });

  it("sorts most recently accessed article first", () => {
    const rows = [
      { accessedAt: "2026-01-01T00:00:00.000Z", article: { documentId: "old", titlu: "Old", tip: "", cale: null } },
      { accessedAt: "2026-06-01T00:00:00.000Z", article: { documentId: "new", titlu: "New", tip: "", cale: null } },
    ];
    expect(aggregateOrgLibraryActivity(rows).map((r) => r.resourceTitle)).toEqual(["New", "Old"]);
  });
});
