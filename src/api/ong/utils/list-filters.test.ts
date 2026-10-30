import { describe, expect, it } from "vitest";
import { NO_PROGRAM, ongListFilters } from "./list-filters";

describe("ongListFilters", () => {
  it("is empty when nothing is filtered", () => {
    expect(ongListFilters({})).toEqual({});
  });

  it("matches one program by documentId", () => {
    expect(ongListFilters({ program: "prog-1" })).toEqual({
      programs: { documentId: "prog-1" },
    });
  });

  it("matches the organizations in no program", () => {
    expect(ongListFilters({ program: NO_PROGRAM })).toEqual({
      programs: { id: { $null: true } },
    });
  });

  it("covers both sign-up days whole, in Bucharest time", () => {
    // UTC+3 until the last Sunday of October, UTC+2 after.
    expect(
      ongListFilters({ inscrisDe: "2026-10-12", inscrisPana: "2026-10-25" }),
    ).toEqual({
      createdAt: {
        $gte: "2026-10-11T21:00:00.000Z",
        $lt: "2026-10-25T22:00:00.000Z",
      },
    });
  });

  it("takes a single day as one whole day", () => {
    expect(
      ongListFilters({ inscrisDe: "2026-01-15", inscrisPana: "2026-01-15" }),
    ).toEqual({
      createdAt: {
        $gte: "2026-01-14T22:00:00.000Z",
        $lt: "2026-01-15T22:00:00.000Z",
      },
    });
  });

  it("leaves an open end open", () => {
    expect(ongListFilters({ inscrisDe: "2026-03-29" })).toEqual({
      createdAt: { $gte: "2026-03-28T22:00:00.000Z" },
    });
    expect(ongListFilters({ inscrisPana: "2026-12-31" })).toEqual({
      createdAt: { $lt: "2026-12-31T22:00:00.000Z" },
    });
  });
});
