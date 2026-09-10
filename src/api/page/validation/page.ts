import { z } from "zod";
import {
  BLOCK_TYPES,
  blocksSchema,
  blocksSchemaBase,
  slugSchema,
  titluSchema,
  vizibilitateSchema,
} from "../../../utils/content-blocks";

export { BLOCK_TYPES };

/** Paths the app itself owns; a page here would shadow a real route. */
export const RESERVED_SLUGS = [
  "dashboard",
  "autentificare",
  "inregistrare",
  "membru",
  "schimbare-email",
  "api",
  "biblioteca",
] as const;

const slug = slugSchema.refine(
  (value) => !(RESERVED_SLUGS as readonly string[]).includes(value),
  { message: "Acest slug este rezervat de aplicație" },
);

/**
 * The parent page, by documentId. `null` moves a page back to the top level;
 * omitting the field leaves the current parent untouched. Whether the parent
 * exists, and whether the resulting nesting is legal, is judged in the
 * controller — both need to read the other pages.
 */
const parinte = z
  .string({ message: "Pagina părinte este invalidă" })
  .trim()
  .min(1, "Pagina părinte este invalidă")
  .nullable();

export const createPageSchema = z.strictObject({
  titlu: titluSchema,
  slug,
  vizibilitate: vizibilitateSchema,
  parinte: parinte.optional(),
  blocuri: blocksSchema,
});

/**
 * `blocuri` uses the undefaulted base: in zod 4 `.default([]).optional()` still
 * fires the default for an absent key, so a partial `PUT` would arrive carrying
 * an empty block list and blank the page. The base keeps an absent key absent.
 */
export const updatePageSchema = z.strictObject({
  titlu: titluSchema.optional(),
  slug: slug.optional(),
  vizibilitate: vizibilitateSchema.optional(),
  parinte: parinte.optional(),
  blocuri: blocksSchemaBase.optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
