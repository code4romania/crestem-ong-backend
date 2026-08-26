import { describe, expect, it } from "vitest";
import { isFdscStaff } from "./fdsc-staff";

describe("isFdscStaff", () => {
  it("accepts the platform administrator", () => {
    expect(isFdscStaff("super-admin")).toBe(true);
  });

  it("accepts the FDSC editor", () => {
    expect(isFdscStaff("editor-fdsc")).toBe(true);
  });

  it("rejects an organization administrator", () => {
    expect(isFdscStaff("ngo-admin")).toBe(false);
  });

  it("rejects a mentor", () => {
    expect(isFdscStaff("mentor")).toBe(false);
  });

  it("rejects a caller with no role at all", () => {
    expect(isFdscStaff(undefined)).toBe(false);
    expect(isFdscStaff(null)).toBe(false);
  });
});
