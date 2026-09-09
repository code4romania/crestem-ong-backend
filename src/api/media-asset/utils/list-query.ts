/**
 * Assembles the Strapi `filters` object for the media library list screen from
 * the three query filters it exposes. Kept out of the controller so the arity
 * rules (0 sub-filters → `{}`, otherwise everything under one `$and`) and the
 * `tip` mime matching stay unit-testable.
 */

/**
 * The `tip` badge on a card comes from `fileTypeCategory(mime)`, which maps a
 * NULL mime to `"file"`. So the `"file"` filter has to catch NULL-mime rows too,
 * otherwise the list and the badge disagree for such a file.
 */
const tipFilter = (tip: string): Record<string, unknown> => {
  if (tip === "image") return { fisier: { mime: { $startsWith: "image/" } } };
  if (tip === "video") return { fisier: { mime: { $startsWith: "video/" } } };
  if (tip === "file")
    return {
      $or: [
        { fisier: { mime: { $null: true } } },
        {
          $and: [
            { fisier: { mime: { $notContains: "image/" } } },
            { fisier: { mime: { $notContains: "video/" } } },
          ],
        },
      ],
    };
  return {};
};

export function buildAssetFilters(params: {
  search: string;
  tip: string;
  slugs: string[];
}): Record<string, unknown> {
  const { search, tip, slugs } = params;
  const and: unknown[] = [];

  if (search) {
    and.push({
      $or: [
        { titlu: { $containsi: search } },
        { fisier: { name: { $containsi: search } } },
      ],
    });
  }
  if (tip) and.push(tipFilter(tip));
  if (slugs.length) and.push({ etichete: { slug: { $in: slugs } } });

  return and.length ? { $and: and } : {};
}
