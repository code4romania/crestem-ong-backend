import { describe, expect, it } from "vitest";
import { fileTypeCategory, isTypeCategoryMismatch } from "./file-type";

describe("fileTypeCategory", () => {
  it("classifies images", () => {
    expect(fileTypeCategory("image/png")).toBe("image");
  });
  it("classifies videos", () => {
    expect(fileTypeCategory("video/mp4")).toBe("video");
  });
  it("classifies everything else as file", () => {
    expect(fileTypeCategory("application/pdf")).toBe("file");
  });
  it("treats missing mime as file", () => {
    expect(fileTypeCategory(null)).toBe("file");
    expect(fileTypeCategory(undefined)).toBe("file");
  });
});

describe("isTypeCategoryMismatch", () => {
  it("flags image replaced by pdf", () => {
    expect(isTypeCategoryMismatch("image/png", "application/pdf")).toBe(true);
  });
  it("flags pdf replaced by image", () => {
    expect(isTypeCategoryMismatch("application/pdf", "image/jpeg")).toBe(true);
  });
  it("allows jpg replaced by png", () => {
    expect(isTypeCategoryMismatch("image/jpeg", "image/png")).toBe(false);
  });
  it("allows pdf replaced by docx", () => {
    expect(
      isTypeCategoryMismatch(
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(false);
  });
  it("allows video replaced by file", () => {
    expect(isTypeCategoryMismatch("video/mp4", "application/pdf")).toBe(false);
  });
});
