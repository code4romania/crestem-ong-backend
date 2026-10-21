import { describe, expect, it, vi } from "vitest";
import {
  enrollmentDates,
  enrollmentKey,
  recordEnrollments,
  removeEnrollments,
} from "./program-enrollments";

const fakeStrapi = (rows: any[] = []) => {
  const api = {
    create: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    findMany: vi.fn(async () => rows),
  };
  return { strapi: { documents: vi.fn(() => api) }, api };
};

describe("recordEnrollments", () => {
  it("dates each organization added to the program", async () => {
    const { strapi, api } = fakeStrapi();
    const at = new Date("2026-10-21T09:00:00.000Z");
    await recordEnrollments(strapi, "p1", ["o1", "o2"], at);
    expect(strapi.documents).toHaveBeenCalledWith(
      "api::program-enrollment.program-enrollment",
    );
    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.create).toHaveBeenCalledWith({
      data: {
        ong: { connect: ["o1"] },
        program: { connect: ["p1"] },
        joinedAt: "2026-10-21T09:00:00.000Z",
      },
    });
  });
});

describe("removeEnrollments", () => {
  it("deletes the program's rows for those organizations", async () => {
    const { strapi, api } = fakeStrapi([{ documentId: "e1" }, { documentId: "e2" }]);
    await removeEnrollments(strapi, "p1", ["o1"]);
    expect(api.findMany).toHaveBeenCalledWith({
      filters: {
        program: { documentId: "p1" },
        ong: { documentId: { $in: ["o1"] } },
      },
    });
    expect(api.delete).toHaveBeenCalledWith({ documentId: "e1" });
    expect(api.delete).toHaveBeenCalledWith({ documentId: "e2" });
  });

  it("does nothing for no organizations", async () => {
    const { strapi, api } = fakeStrapi();
    await removeEnrollments(strapi, "p1", []);
    expect(api.findMany).not.toHaveBeenCalled();
  });
});

describe("enrollmentDates", () => {
  it("keys each date by organization and program, keeping the earliest", async () => {
    const { strapi } = fakeStrapi([
      { ong: { documentId: "o1" }, program: { documentId: "p1" }, joinedAt: "2026-05-01T10:00:00.000Z" },
      { ong: { documentId: "o1" }, program: { documentId: "p1" }, joinedAt: "2026-03-01T10:00:00.000Z" },
      { ong: { documentId: "o1" }, program: { documentId: "p2" }, joinedAt: "2026-06-01T10:00:00.000Z" },
      { ong: null, program: { documentId: "p2" }, joinedAt: "2026-06-01T10:00:00.000Z" },
    ]);
    const dates = await enrollmentDates(strapi, ["o1"]);
    expect(dates.get(enrollmentKey("o1", "p1"))).toBe("2026-03-01T10:00:00.000Z");
    expect(dates.get(enrollmentKey("o1", "p2"))).toBe("2026-06-01T10:00:00.000Z");
    expect(dates.size).toBe(2);
  });
});
