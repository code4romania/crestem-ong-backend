import { z } from "zod";
import {
  blocksSchema,
  blocksSchemaBase,
  slugSchema,
  titluSchema,
  vizibilitateSchema,
} from "../../../utils/content-blocks";

/**
 * The grey line under the title in the admin list, and the excerpt on the
 * article card in the public library. Free text, typed by the editor, never
 * generated.
 *
 * Undefaulted base + defaulted variant: in zod 4, `schema.default(v).optional()`
 * still applies the default when the key is absent (`.optional()` does not
 * short-circuit a `ZodDefault`), which would make a partial `PUT` silently
 * blank out every field it did not mention. `create` uses the defaulted form;
 * `update` uses the base, so an absent key stays absent through parsing.
 */
const rezumatBase = z.string().trim().max(400, "Rezumatul este prea lung");
const rezumat = rezumatBase.default("");

/**
 * Free text rather than an enum: the vocabulary ("Ghid", "Template", "Video")
 * is the editors', and a category's filter offers exactly the values its own
 * articles use. An empty `tip` renders no badge.
 */
const tipBase = z.string().trim().max(60, "Tipul este prea lung");

/**
 * Free text rather than a relation: articles carry external contributors who
 * have no account in the app.
 */
const autorBase = z.string().trim().max(120, "Numele autorului este prea lung");
const autor = autorBase.default("");

const eticheteBase = z
  .array(z.string().trim().min(1, "Eticheta nu poate fi goală").max(40, "Eticheta este prea lungă"))
  .max(20, "Cel mult 20 de etichete")
  .refine((value) => new Set(value).size === value.length, {
    message: "Fiecare etichetă poate apărea o singură dată",
  });
const etichete = eticheteBase.default([]);

/**
 * The subcategory, by documentId. Required: an article cannot attach to a bare
 * category, because its public path is assembled from the subcategory and that
 * subcategory's parent. Whether the target exists and actually has a parent is
 * judged in the controller, which can read the taxonomy.
 */
const subcategorie = z
  .string({ message: "Subcategoria este obligatorie" })
  .trim()
  .min(1, "Subcategoria este obligatorie");

export const createArticleSchema = z.strictObject({
  titlu: titluSchema,
  slug: slugSchema,
  rezumat,
  subcategorie,
  autor,
  etichete,
  tip: tipBase.default(""),
  vizibilitate: vizibilitateSchema,
  blocuri: blocksSchema,
});

export const updateArticleSchema = z.strictObject({
  titlu: titluSchema.optional(),
  slug: slugSchema.optional(),
  rezumat: rezumatBase.optional(),
  subcategorie: subcategorie.optional(),
  autor: autorBase.optional(),
  etichete: eticheteBase.optional(),
  tip: tipBase.optional(),
  vizibilitate: vizibilitateSchema.optional(),
  blocuri: blocksSchemaBase.optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
