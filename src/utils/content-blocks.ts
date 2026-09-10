import { z } from "zod";
import { VISIBILITY_AUDIENCES } from "../api/page/utils/visibility";

/**
 * Every block the frontend can place, from `registry.ts`. Names, not shapes:
 * the leaf payloads are validated there, and mirroring them here would give
 * the same block two definitions that drift apart silently. A stale name fails
 * loudly at save instead.
 *
 * Shared by `page` and `article`, which store identical block trees.
 */
export const BLOCK_TYPES = [
  "article-grid",
  "article-header",
  "callout",
  "category-grid",
  "columns",
  "custom-html",
  "divider",
  "documents",
  "embed",
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
  "partners",
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

/**
 * Undefaulted so a partial update can tell "the field was not sent" (key
 * absent, base with no default) apart from "the field was sent as empty"
 * (`.default([])` only ever fires on `undefined`, never distinguishes the
 * two on its own — callers that need the distinction use this base directly).
 */
export const blocksSchemaBase = z
  .array(blockEnvelope)
  .superRefine((value, ctx) => {
    if (JSON.stringify(value).length > MAX_BLOCKS_BYTES) {
      ctx.addIssue({
        code: "custom",
        message: "Conținutul depășește dimensiunea maximă de 1 MB",
      });
      return;
    }
    checkBlockList(value, ctx, []);
  });

export const blocksSchema = blocksSchemaBase.default([]);

export const titluSchema = z
  .string({ message: "Titlul este obligatoriu" })
  .trim()
  .min(1, "Titlul este obligatoriu");

/**
 * The url-safe shape only. `page` narrows this further with its reserved-prefix
 * list; an article slug is the fourth segment of a path that already begins
 * with `biblioteca`, so it can never shadow an app route.
 */
export const slugSchema = z
  .string({ message: "Slugul este obligatoriu" })
  .trim()
  .min(1, "Slugul este obligatoriu")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slugul poate conține doar litere mici, cifre și cratime");

export const vizibilitateSchema = z
  .array(z.enum(VISIBILITY_AUDIENCES, { message: "Audiență necunoscută" }))
  .min(1, "Alege cel puțin o audiență")
  .refine((value) => new Set(value).size === value.length, {
    message: "Fiecare audiență poate apărea o singură dată",
  });
