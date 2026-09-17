import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { seedHomepage } from "./seed-homepage";

const ASSET = path.join(__dirname, "..", "..", "public", "seed", "homepage-hero.jpg");

function fakeStrapi({ existing = null as unknown, file = null as any } = {}) {
  const create = vi.fn(async ({ data }: any) => ({ documentId: "home-1", ...data }));
  const upload = vi.fn(async () => [
    { id: 7, url: "/uploads/homepage-hero.jpg", name: "homepage-hero.jpg" },
  ]);

  const strapi = {
    documents: () => ({ findFirst: async () => existing, create }),
    db: { query: () => ({ findOne: async () => file }) },
    plugin: () => ({ service: () => ({ upload }) }),
    log: { info: vi.fn(), warn: vi.fn() },
  } as any;

  return { strapi, create, upload };
}

describe("seedHomepage", () => {
  it("creates a published homepage carrying one hero block", async () => {
    const { strapi, create } = fakeStrapi();

    await seedHomepage(strapi, { assetPath: ASSET });

    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];
    expect(data.esteHomepage).toBe(true);
    expect(data.slug).toBe("homepage");
    expect(data.stare).toBe("publicat");
    expect(data.vizibilitate).toEqual(["public"]);
    expect(data.blocuri).toHaveLength(1);
    expect(data.blocuri[0].type).toBe("hero-large-split");
    expect(data.blocuri[0].data.titlu).toBe("ONG-ul tău la următorul nivel");
    expect(data.blocuri[0].data.primaryCta.href).toBe("/inregistrare");
    expect(data.blocuri[0].data.secondaryCta.href).toBe("/biblioteca");
  });

  it("attaches the uploaded image to the block and to the page's files", async () => {
    const { strapi, create, upload } = fakeStrapi();

    await seedHomepage(strapi, { assetPath: ASSET });

    expect(upload).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];
    expect(data.blocuri[0].data.image).toEqual({
      id: 7,
      url: "/uploads/homepage-hero.jpg",
      name: "homepage-hero.jpg",
    });
    expect(data.blocuri[0].data.imageAlt).toBe("Echipă ONG");
    expect(data.fisiere).toEqual([7]);
  });

  it("reuses a file already in the library instead of uploading a second copy", async () => {
    const { strapi, create, upload } = fakeStrapi({
      file: { id: 3, url: "/uploads/homepage-hero.jpg", name: "homepage-hero.jpg" },
    });

    await seedHomepage(strapi, { assetPath: ASSET });

    expect(upload).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.blocuri[0].data.image.id).toBe(3);
  });

  it("does nothing when a homepage already exists", async () => {
    const { strapi, create } = fakeStrapi({ existing: { documentId: "home-1" } });

    await seedHomepage(strapi, { assetPath: ASSET });

    expect(create).not.toHaveBeenCalled();
  });

  it("seeds without an image rather than failing when the asset is missing", async () => {
    const { strapi, create } = fakeStrapi();

    await seedHomepage(strapi, { assetPath: "does/not/exist.jpg" });

    expect(create).toHaveBeenCalledTimes(1);
    const { data } = create.mock.calls[0][0];
    expect(data.blocuri[0].data.image).toBeNull();
    // The block schema refuses an image without alt text; with no image, an
    // empty alt is what it expects.
    expect(data.blocuri[0].data.imageAlt).toBe("");
    expect(data.fisiere).toEqual([]);
    expect(strapi.log.warn).toHaveBeenCalled();
  });
});
