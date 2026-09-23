import { describe, expect, it } from "vitest";
import { blocksSchema } from "./content-blocks";

const block = (type: string, data: unknown = {}) => ({ id: `${type}-1`, type, data });

describe("blocksSchema", () => {
  it("accepts a contact block at the top level", () => {
    expect(blocksSchema.safeParse([block("contact")]).success).toBe(true);
  });

  it("accepts a contact block nested inside a section", () => {
    const tree = [block("section", { blocuri: [block("contact")] })];
    expect(blocksSchema.safeParse(tree).success).toBe(true);
  });

  it("accepts a contact block nested inside a column", () => {
    const tree = [block("columns", { coloane: [{ blocuri: [block("contact")] }] })];
    expect(blocksSchema.safeParse(tree).success).toBe(true);
  });

  it("still rejects a type no block declares", () => {
    const parsed = blocksSchema.safeParse([block("nu-exista")]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe("Tip de bloc necunoscut: nu-exista");
    }
  });
});
