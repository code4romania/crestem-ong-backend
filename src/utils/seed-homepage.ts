import fs from "node:fs";
import path from "node:path";
import type { Core } from "@strapi/strapi";

/**
 * The landing page. Seeded so `/` always resolves: the public route reads it
 * like any other page, and an environment without the row would serve a 404 at
 * the site root. Content mirrors the Hero component this replaced; the editor
 * owns it from the first save onwards.
 *
 * The page cannot be deleted, withdrawn, emptied or moved — see
 * `src/api/page/utils/homepage.ts` for the rules the API enforces.
 */

const CTA_DEFAULTS = { label: "", href: "", pagina: "", subPagina: false };

const IMAGE_ALT = "Echipă ONG";

const DEFAULT_ASSET_PATH = path.join(process.cwd(), "public", "seed", "homepage-hero.jpg");

interface BlockImage {
  id: number;
  url: string;
  name: string;
}

/**
 * Puts the bundled hero image in the Media Library, or reuses the row already
 * there. The block stores a `{ id, url, name }` snapshot, so the file has to
 * exist as an upload row — a remote URL is not something the picker, the media
 * resolver or the library screen can work with.
 *
 * A missing asset is not fatal: the image is optional in the block schema, so
 * the page still renders and an editor picks one in the builder.
 */
async function uploadHeroImage(
  strapi: Core.Strapi,
  assetPath: string,
): Promise<BlockImage | null> {
  if (!fs.existsSync(assetPath)) {
    strapi.log.warn(
      `[bootstrap] Homepage: lipsește ${assetPath}, pagina pornește fără imagine.`,
    );
    return null;
  }

  const name = path.basename(assetPath);
  const existing = await (strapi as any).db
    .query("plugin::upload.file")
    .findOne({ where: { name } });
  if (existing) return { id: existing.id, url: existing.url, name: existing.name };

  const uploaded = await strapi
    .plugin("upload")
    .service("upload")
    .upload({
      data: { fileInfo: { name, alternativeText: IMAGE_ALT } },
      files: {
        filepath: assetPath,
        originalFilename: name,
        mimetype: "image/jpeg",
        size: fs.statSync(assetPath).size,
      },
    });

  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  return file ? { id: file.id, url: file.url, name: file.name } : null;
}

export async function seedHomepage(
  strapi: Core.Strapi,
  { assetPath = DEFAULT_ASSET_PATH }: { assetPath?: string } = {},
) {
  const existing = await strapi
    .documents("api::page.page")
    .findFirst({ filters: { esteHomepage: true } } as any);
  if (existing) return;

  const image = await uploadHeroImage(strapi, assetPath);

  await strapi.documents("api::page.page").create({
    data: {
      titlu: "Homepage",
      slug: "homepage",
      esteHomepage: true,
      stare: "publicat",
      vizibilitate: ["public"],
      fisiere: image ? [image.id] : [],
      blocuri: [
        {
          id: "homepage-hero",
          type: "hero-large-split",
          data: {
            supratitlu: "Platforma #1 pentru organizații din România",
            titlu: "ONG-ul tău la următorul nivel",
            subtitlu:
              "Crestem este platforma care reunește resurse, instrumente juridice, programe de accelerare și o comunitate vibrantă pentru toți cei care construiesc schimbarea în România.",
            image,
            // The block schema refuses an image without alt text, and an empty
            // alt is what it expects when there is no image.
            imageAlt: image ? IMAGE_ALT : "",
            imagePosition: "dreapta",
            verticalAlign: "centru",
            // Both targets are app routes rather than `page` rows, so they
            // travel as `href`: there is no documentId for `pagina` to hold.
            primaryCta: { ...CTA_DEFAULTS, label: "Înregistrează-te", href: "/inregistrare" },
            secondaryCta: { ...CTA_DEFAULTS, label: "Explorează resurse", href: "/biblioteca" },
          },
        },
      ],
    } as any,
  });

  strapi.log.info("[bootstrap] Created homepage page.");
}
