import { describe, expect, it } from "vitest";
import { nextDataPublicarii } from "./publish";

const now = new Date("2026-06-01T10:00:00.000Z");

describe("nextDataPublicarii", () => {
  it("stamps the first publish", () => {
    expect(nextDataPublicarii({ stare: "publicat", current: null, now })).toBe(
      "2026-06-01T10:00:00.000Z",
    );
  });

  it("leaves an existing date alone on republish", () => {
    expect(
      nextDataPublicarii({ stare: "publicat", current: "2026-05-15T08:00:00.000Z", now }),
    ).toBe("2026-05-15T08:00:00.000Z");
  });

  it("keeps the date when the article is withdrawn", () => {
    expect(
      nextDataPublicarii({ stare: "schita", current: "2026-05-15T08:00:00.000Z", now }),
    ).toBe("2026-05-15T08:00:00.000Z");
  });

  it("leaves a never-published draft with no date", () => {
    expect(nextDataPublicarii({ stare: "schita", current: null, now })).toBeNull();
  });
});
