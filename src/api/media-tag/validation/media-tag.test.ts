import { describe, expect, it } from "vitest";
import { createMediaTagSchema } from "./media-tag";

describe("createMediaTagSchema", () => {
  it("accepts a trimmed name", () => {
    const parsed = createMediaTagSchema.safeParse({ nume: "  logo  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.nume).toBe("logo");
  });

  it("rejects an empty name", () => {
    expect(createMediaTagSchema.safeParse({ nume: "   " }).success).toBe(false);
  });

  it("rejects a name over 50 chars", () => {
    expect(createMediaTagSchema.safeParse({ nume: "x".repeat(51) }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(createMediaTagSchema.safeParse({ nume: "logo", extra: 1 }).success).toBe(false);
  });
});
