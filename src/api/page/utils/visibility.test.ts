import { describe, expect, it } from "vitest";
import { canView } from "./visibility";

const draft = { stare: "schita" as const, vizibilitate: ["public"] };
const published = (vizibilitate: string[]) => ({
  stare: "publicat" as const,
  vizibilitate,
});

describe("canView", () => {
  it("hides a draft from an anonymous visitor", () => {
    expect(canView(draft, null)).toBe(false);
  });

  it("shows a draft to FDSC staff", () => {
    expect(canView(draft, "editor-fdsc")).toBe(true);
    expect(canView(draft, "super-admin")).toBe(true);
  });

  it("hides a draft from a signed-in non-staff user", () => {
    expect(canView(draft, "ngo-admin")).toBe(false);
  });

  it("shows a public page to an anonymous visitor", () => {
    expect(canView(published(["public"]), null)).toBe(true);
  });

  it("hides a restricted page from an anonymous visitor", () => {
    expect(canView(published(["ngo-admin"]), null)).toBe(false);
  });

  it("shows a restricted page to the audience it names", () => {
    expect(canView(published(["ngo-admin"]), "ngo-admin")).toBe(true);
  });

  it("hides a restricted page from a different signed-in role", () => {
    expect(canView(published(["ngo-admin"]), "mentor")).toBe(false);
  });

  it("maps both staff roles onto the fdsc audience", () => {
    expect(canView(published(["fdsc"]), "super-admin")).toBe(true);
    expect(canView(published(["fdsc"]), "editor-fdsc")).toBe(true);
    expect(canView(published(["fdsc"]), "ngo-member")).toBe(false);
  });

  it("hides a published page with no audiences at all", () => {
    expect(canView(published([]), "ngo-admin")).toBe(false);
  });
});
