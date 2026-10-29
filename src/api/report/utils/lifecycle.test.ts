import { describe, expect, it } from "vitest";
import { adminCloseError, adminReopenError } from "./lifecycle";

const TODAY = "2026-10-29";

const report = (overrides: Record<string, unknown> = {}) => ({
  finished: false,
  phases: [] as { endDate: string }[],
  ...overrides,
});

describe("adminCloseError", () => {
  it("lets an open independent round close", () => {
    expect(adminCloseError(report(), TODAY)).toBeNull();
  });

  it("lets a program round close before its phase ends", () => {
    expect(
      adminCloseError(report({ phases: [{ endDate: "2026-11-30" }] }), TODAY),
    ).toBeNull();
  });

  it("refuses a round already finished", () => {
    expect(adminCloseError(report({ finished: true }), TODAY)).not.toBeNull();
  });

  it("refuses a round whose phases have all ended, even if still unfinished", () => {
    expect(
      adminCloseError(report({ phases: [{ endDate: "2026-10-28" }] }), TODAY),
    ).not.toBeNull();
  });
});

describe("adminReopenError", () => {
  it("reopens a finished independent round", () => {
    expect(adminReopenError(report({ finished: true }), TODAY, false)).toBeNull();
  });

  it("reopens a finished program round while its phase runs", () => {
    expect(
      adminReopenError(
        report({ finished: true, phases: [{ endDate: TODAY }] }),
        TODAY,
        false,
      ),
    ).toBeNull();
  });

  it("reopens a round shared by two programs while one phase still runs", () => {
    expect(
      adminReopenError(
        report({
          finished: true,
          phases: [{ endDate: "2026-10-01" }, { endDate: "2026-11-30" }],
        }),
        TODAY,
        false,
      ),
    ).toBeNull();
  });

  it("refuses once every phase has ended", () => {
    expect(
      adminReopenError(
        report({ finished: true, phases: [{ endDate: "2026-10-28" }] }),
        TODAY,
        false,
      ),
    ).toMatch(/Faza de evaluare s-a încheiat/);
  });

  it("refuses a round that is still under way", () => {
    expect(adminReopenError(report(), TODAY, false)).toMatch(
      /deja în desfășurare/,
    );
  });

  it("refuses while the organization runs another round", () => {
    expect(adminReopenError(report({ finished: true }), TODAY, true)).toMatch(
      /Organizația are deja o evaluare în desfășurare/,
    );
  });
});
