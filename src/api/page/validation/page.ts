import { z } from "zod";
import { VISIBILITY_AUDIENCES } from "../utils/visibility";

/**
 * Every block the frontend can place, from `registry.ts`. Names, not shapes:
 * the 27 leaf payloads are validated there, and mirroring them here would give
 * the same block two definitions that drift apart silently. A stale name fails
 * loudly at save instead.
 */
export const BLOCK_TYPES = [
  "article-grid",
  "callout",
  "category-grid",
  "columns",
  "divider",
  "faq-collection",
  "feature-cards",
  "gallery",
  "hero-centered",
  "hero-intro",
  "hero-large-split",
  "hero-statistics",
  "image",
  "image-caption",
  "image-text",
  "numbered-process",
  "partner-collection",
  "people-collection",
  "people-grid",
  "program-header",
  "programme-grid",
  "quote",
  "rich-text",
  "section",
  "section-header",
  "spacer",
  "statistics",
  "testimonials",
  "timeline",
  "video",
] as const;

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

/** Roughly 1 MB of JSON, measured after parsing. */
const MAX_BLOCKS_BYTES = 1_000_000;

const blockTypes = new Set<string>(BLOCK_TYPES);

interface RawBlock {
  id: string;
  type: string;
  data?: unknown;
}

const blockEnvelope: z.ZodType<RawBlock> = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.unknown().optional(),
});

/**
 * Walks the tree the way the builder writes it: a `section` keeps its children
 * in `data.blocuri`, a `columns` keeps one list per entry of `data.coloane`.
 * Checks only what the backend can know — the type exists, and ids do not
 * repeat within one list.
 */
function checkBlockList(blocks: RawBlock[], ctx: z.RefinementCtx, path: (string | number)[]) {
  const seen = new Set<string>();

  blocks.forEach((block, index) => {
    if (!blockTypes.has(block.type)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "type"],
        message: `Tip de bloc necunoscut: ${block.type}`,
      });
    }

    if (seen.has(block.id)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index, "id"],
        message: `Identificator de bloc duplicat: ${block.id}`,
      });
    }
    seen.add(block.id);

    const data = (block.data ?? {}) as Record<string, unknown>;

    if (Array.isArray(data.blocuri)) {
      checkBlockList(data.blocuri as RawBlock[], ctx, [...path, index, "data", "blocuri"]);
    }

    if (Array.isArray(data.coloane)) {
      (data.coloane as Record<string, unknown>[]).forEach((column, columnIndex) => {
        if (Array.isArray(column?.blocuri)) {
          checkBlockList(column.blocuri as RawBlock[], ctx, [
            ...path,
            index,
            "data",
            "coloane",
            columnIndex,
            "blocuri",
          ]);
        }
      });
    }
  });
}

const blocks = z
  .array(blockEnvelope)
  .default([])
  .superRefine((value, ctx) => {
    if (JSON.stringify(value).length > MAX_BLOCKS_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: "Conținutul paginii depășește dimensiunea maximă de 1 MB",
      });
      return;
    }
    checkBlockList(value, ctx, []);
  });

const titlu = z
  .string({ message: "Titlul este obligatoriu" })
  .trim()
  .min(1, "Titlul este obligatoriu");

const slug = z
  .string({ message: "Slugul este obligatoriu" })
  .trim()
  .min(1, "Slugul este obligatoriu")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slugul poate conține doar litere mici, cifre și cratime")
  .refine((value) => !(RESERVED_SLUGS as readonly string[]).includes(value), {
    message: "Acest slug este rezervat de aplicație",
  });

const vizibilitate = z
  .array(z.enum(VISIBILITY_AUDIENCES, { message: "Audiență necunoscută" }))
  .min(1, "Alege cel puțin o audiență")
  .refine((value) => new Set(value).size === value.length, {
    message: "Fiecare audiență poate apărea o singură dată",
  });

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
  titlu,
  slug,
  vizibilitate,
  parinte: parinte.optional(),
  blocuri: blocks,
});

export const updatePageSchema = z.strictObject({
  titlu: titlu.optional(),
  slug: slug.optional(),
  vizibilitate: vizibilitate.optional(),
  parinte: parinte.optional(),
  blocuri: blocks.optional(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
