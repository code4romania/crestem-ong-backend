import { describe, expect, it } from "vitest";
import { createMediaAssetSchema, updateMediaAssetSchema } from "./media-asset";

describe("createMediaAssetSchema", () => {
  it("accepts a minimal valid payload", () => {
    const parsed = createMediaAssetSchema.safeParse({ fisierId: 12, titlu: "Logo FDSC" });
    expect(parsed.success).toBe(true);
  });

  it("accepts tags and a description", () => {
    const parsed = createMediaAssetSchema.safeParse({
      fisierId: 12,
      titlu: "Logo",
      descriere: "pe fundal transparent",
      eticheteIds: [1, 2],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-positive fisierId", () => {
    expect(createMediaAssetSchema.safeParse({ fisierId: 0, titlu: "x" }).success).toBe(false);
  });

  it("rejects a missing titlu", () => {
    expect(createMediaAssetSchema.safeParse({ fisierId: 1 }).success).toBe(false);
  });

  it("rejects a titlu over 200 chars", () => {
    expect(
      createMediaAssetSchema.safeParse({ fisierId: 1, titlu: "x".repeat(201) }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      createMediaAssetSchema.safeParse({ fisierId: 1, titlu: "x", nope: true }).success,
    ).toBe(false);
  });
});

describe("updateMediaAssetSchema", () => {
  it("accepts a partial metadata update", () => {
    expect(updateMediaAssetSchema.safeParse({ titlu: "Nou" }).success).toBe(true);
  });

  it("accepts altText and null descriere", () => {
    const parsed = updateMediaAssetSchema.safeParse({ altText: "Sigla organizației", descriere: null });
    expect(parsed.success).toBe(true);
  });

  it("rejects altText over 500 chars", () => {
    expect(updateMediaAssetSchema.safeParse({ altText: "x".repeat(501) }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(updateMediaAssetSchema.safeParse({ fisierId: 5 }).success).toBe(false);
  });
});
