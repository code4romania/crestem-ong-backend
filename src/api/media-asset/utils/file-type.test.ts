import { describe, expect, it } from "vitest";
import { fileTypeCategory, formatToken, isFileFormatMismatch } from "./file-type";

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

describe("formatToken", () => {
  it("reads a stored extension", () => {
    expect(formatToken(".png", "application/pdf")).toBe("png");
  });
  it("reads an extension off a filename or path", () => {
    expect(formatToken("Screenshot 2026-09-10.PNG", null)).toBe("png");
    expect(formatToken("/uploads/a.b.webp", null)).toBe("webp");
  });
  it("collapses jpeg to jpg", () => {
    expect(formatToken(".jpeg", null)).toBe("jpg");
    expect(formatToken("photo.JPG", null)).toBe("jpg");
  });
  it("falls back to the mime when there is no extension", () => {
    expect(formatToken(null, "image/png")).toBe("png");
    expect(formatToken("noextension", "application/pdf")).toBe("pdf");
  });
  it("is empty when nothing is knowable", () => {
    expect(formatToken(null, null)).toBe("");
    expect(formatToken("", "application/octet-stream")).toBe("");
  });
});

describe("isFileFormatMismatch", () => {
  it("flags png replaced by pdf", () => {
    expect(isFileFormatMismatch("png", "pdf")).toBe(true);
  });
  it("flags png replaced by jpg", () => {
    expect(isFileFormatMismatch("png", "jpg")).toBe(true);
  });
  it("allows the same format", () => {
    expect(isFileFormatMismatch("png", "png")).toBe(false);
  });
  it("allows a same-extension replace even if the current mime is stale", () => {
    // Corrupt row: ext .png but mime application/pdf from an earlier bad replace.
    // Comparing the extension token lets a real PNG replace heal it.
    expect(
      isFileFormatMismatch(
        formatToken(".png", "application/pdf"),
        formatToken("new-screenshot.png", "image/png"),
      ),
    ).toBe(false);
  });
  it("still blocks a format change on a corrupt row", () => {
    expect(
      isFileFormatMismatch(
        formatToken(".png", "application/pdf"),
        formatToken("Contract.pdf", "application/pdf"),
      ),
    ).toBe(true);
  });
  it("does not block when a side is unknown", () => {
    expect(isFileFormatMismatch("", "png")).toBe(false);
    expect(isFileFormatMismatch("png", "")).toBe(false);
  });
});
