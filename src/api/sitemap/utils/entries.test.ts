import { describe, expect, it } from "vitest";
import { publicEntries } from "./entries";

const actualizat = "2026-09-28T10:00:00.000Z";

describe("publicEntries", () => {
  it("keeps a published page visible to the public", () => {
    const rows = [{ cale: "/despre-noi", actualizat, stare: "publicat" as const, vizibilitate: ["public"] }];
    expect(publicEntries(rows)).toEqual([{ cale: "/despre-noi", actualizat }]);
  });

  it("drops a draft, even one marked public", () => {
    const rows = [{ cale: "/schita", actualizat, stare: "schita" as const, vizibilitate: ["public"] }];
    expect(publicEntries(rows)).toEqual([]);
  });

  it("drops a published page restricted to signed-in audiences", () => {
    const rows = [
      { cale: "/doar-ong", actualizat, stare: "publicat" as const, vizibilitate: ["ngo-admin", "ngo-member"] },
    ];
    expect(publicEntries(rows)).toEqual([]);
  });

  it("drops a row without a URL", () => {
    const rows = [{ cale: null, actualizat, stare: "publicat" as const, vizibilitate: ["public"] }];
    expect(publicEntries(rows)).toEqual([]);
  });

  it("returns only the URL and the date", () => {
    const rows = [{ cale: "/", actualizat, stare: "publicat" as const, vizibilitate: ["public", "fdsc"] }];
    expect(publicEntries(rows)).toEqual([{ cale: "/", actualizat }]);
  });
});
