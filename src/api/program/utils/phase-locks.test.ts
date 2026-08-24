import { describe, expect, it } from "vitest";
import { programFinishedError } from "./phase-locks";

const TODAY = "2026-08-24";

describe("programFinishedError", () => {
  it("locks a program whose end date has passed", () => {
    expect(
      programFinishedError(
        { startDate: "2026-01-01", endDate: "2026-08-23" },
        TODAY,
      ),
    ).toBe("Programul este finalizat și nu mai poate fi modificat");
  });

  it("leaves a program ending today open", () => {
    expect(
      programFinishedError(
        { startDate: "2026-01-01", endDate: TODAY },
        TODAY,
      ),
    ).toBeNull();
  });

  it("leaves an active program open", () => {
    expect(
      programFinishedError(
        { startDate: "2026-01-01", endDate: "2026-12-31" },
        TODAY,
      ),
    ).toBeNull();
  });

  it("leaves an upcoming program open", () => {
    expect(
      programFinishedError(
        { startDate: "2026-09-01", endDate: "2026-12-31" },
        TODAY,
      ),
    ).toBeNull();
  });

  it("reads Date columns, not just date strings", () => {
    expect(
      programFinishedError(
        {
          startDate: new Date("2026-01-01T00:00:00Z"),
          endDate: new Date("2026-08-23T00:00:00Z"),
        },
        TODAY,
      ),
    ).toBe("Programul este finalizat și nu mai poate fi modificat");
  });
});
