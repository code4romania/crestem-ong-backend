import { describe, expect, it } from "vitest";
import { updateMentorSchema } from "./admin-user";

const base = { nume: "Ion Popescu" };

describe("updateMentorSchema — bio", () => {
  it("accepts rich-text markup as long as the visible text stays within the limit", () => {
    const bio = `<p><strong>${"a".repeat(1000)}</strong></p>`;
    const parsed = updateMentorSchema.safeParse({ ...base, bio });
    expect(parsed.success).toBe(true);
  });

  it("rejects bio whose visible text exceeds the limit, markup aside", () => {
    const bio = `<p>${"a".repeat(1001)}</p>`;
    const parsed = updateMentorSchema.safeParse({ ...base, bio });
    expect(parsed.success).toBe(false);
  });
});
