import { z } from "zod";
import { slugSchema } from "../../../utils/content-blocks";

/**
 * The icon palette, identical to the frontend's `CATEGORY_ICON_KEYS` in
 * `blocks/category-grid/schema.ts`. Kept as a literal here rather than shared:
 * the two repos have no shared package, and this list changes about never.
 */
export const LIBRARY_ICON_KEYS = [
  "folder",
  "settings",
  "scale",
  "message",
  "trending",
  "users",
  "award",
  "book",
  "globe",
  "heart",
  "briefcase",
  "calendar",
] as const;

const descriereBase = z
  .string()
  .trim()
  .max(500, "Descrierea este prea lungă");

const iconBase = z.enum(LIBRARY_ICON_KEYS, { message: "Pictogramă necunoscută" });

const nume = z
  .string({ message: "Numele este obligatoriu" })
  .trim()
  .min(1, "Numele este obligatoriu")
  .max(120, "Numele este prea lung");

/**
 * The parent category, by documentId. `null` is a top-level category. Whether
 * the parent exists, and whether the result stays two levels deep, is judged in
 * the controller by `checkParent` — both need to read the other rows.
 */
const parinte = z
  .string({ message: "Categoria părinte este invalidă" })
  .trim()
  .min(1, "Categoria părinte este invalidă")
  .nullable();

export const createCategorySchema = z.strictObject({
  nume,
  slug: slugSchema,
  parinte: parinte.default(null),
  descriere: descriereBase.default(""),
  icon: iconBase.default("folder"),
});

export const updateCategorySchema = z.strictObject({
  nume: nume.optional(),
  slug: slugSchema.optional(),
  parinte: parinte.optional(),
  descriere: descriereBase.optional(),
  icon: iconBase.optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
