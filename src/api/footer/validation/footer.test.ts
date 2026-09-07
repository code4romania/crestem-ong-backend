import { describe, expect, it } from "vitest";
import { updateFooterSchema } from "./footer";

const valid = {
  description: "<p>Platforma de creștere pentru organizațiile neguvernamentale.</p>",
  copyright: "© 2026 Crestem. Toate drepturile rezervate.",
  socials: [
    { platform: "facebook", url: "https://facebook.com/crestem" },
    { platform: "linkedin", url: "https://linkedin.com/company/crestem" },
  ],
};

describe("updateFooterSchema", () => {
  it("accepts a complete footer", () => {
    expect(updateFooterSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a footer with no socials at all", () => {
    const parsed = updateFooterSchema.safeParse({ ...valid, socials: [] });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown platform", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [{ platform: "myspace", url: "https://myspace.com/crestem" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a social link written as a site path", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [{ platform: "facebook", url: "/facebook" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("prefixes https:// on an address typed without a scheme", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [{ platform: "facebook", url: "facebook.com/crestem" }],
    });
    expect(parsed.success && parsed.data.socials[0].url).toBe("https://facebook.com/crestem");
  });

  it("leaves an address that already carries a scheme untouched", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [{ platform: "facebook", url: "http://facebook.com/crestem" }],
    });
    expect(parsed.success && parsed.data.socials[0].url).toBe("http://facebook.com/crestem");
  });

  it("rejects the same known platform listed twice", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [
        { platform: "facebook", url: "https://facebook.com/a" },
        { platform: "facebook", url: "https://facebook.com/b" },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts github", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [{ platform: "github", url: "https://github.com/crestem" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a custom network when it is named", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [{ platform: "other", label: "Substack", url: "https://crestem.substack.com" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a custom network without a name", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [{ platform: "other", url: "https://crestem.substack.com" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts several custom networks — only known platforms are unique", () => {
    const parsed = updateFooterSchema.safeParse({
      ...valid,
      socials: [
        { platform: "other", label: "Substack", url: "https://crestem.substack.com" },
        { platform: "other", label: "Discord", url: "https://discord.gg/crestem" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a logo field — images live in the description instead", () => {
    const parsed = updateFooterSchema.safeParse({ ...valid, logo: 42 });
    expect(parsed.success).toBe(false);
  });
});
