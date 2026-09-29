import { z } from "zod";
import { slugSchema } from "../../../utils/content-blocks";

/**
 * A category's icon: `lucide:<kebab-name>` for any lucide icon, or a legacy key
 * of the former twelve-icon palette (`folder`, `book`…), which older rows still
 * hold. Shape only — the backend doesn't know lucide's list; the frontend
 * (`components/ui/icons`) maps legacy keys and falls back on unknown names.
 */
const ICON_PATTERN = /^(?:lucide:)?[a-z0-9]+(?:-[a-z0-9]+)*$/;

const descriereBase = z
  .string()
  .trim()
  .max(2500, "Descrierea este prea lungă");

const iconBase = z
  .string({ message: "Pictogramă necunoscută" })
  // `lucide:` + the frontend's 64-character name cap.
  .max(71, "Pictogramă necunoscută")
  .regex(ICON_PATTERN, "Pictogramă necunoscută");

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
