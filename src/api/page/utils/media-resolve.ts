/**
 * Block file references are plain JSON: `{ id, url, name }` written by the page
 * builder. The file behind an `id` can change after the block was saved — a
 * Media Library replace swaps the bytes and the URL, an edit changes the alt
 * text — so a served page must not trust the stored `url`. This walks the block
 * tree (the same shape `collectFileIds` scans) and, for every file node,
 * overwrites `url`/`name` and injects `alternativeText` from the current file
 * row. A node whose `id` no longer resolves is dropped, exactly as
 * `applyPageLinks` drops a CTA whose target is gone.
 *
 * The stored `url` stays in the JSON on save (the editor shows it optimistically);
 * this makes the read-time value authoritative without a migration.
 */

export interface ResolvedFile {
  url: string;
  name: string;
  alternativeText: string | null;
}

const isFileNode = (node: unknown): node is { id: number; url: string } =>
  typeof node === "object" &&
  node !== null &&
  typeof (node as any).id === "number" &&
  typeof (node as any).url === "string";

export function applyResolvedMedia(
  blocks: unknown,
  filesById: Map<number, ResolvedFile>,
): unknown {
  const walk = (node: unknown): { value: unknown; drop: boolean } => {
    if (Array.isArray(node)) {
      const next: unknown[] = [];
      for (const entry of node) {
        const result = walk(entry);
        if (!result.drop) next.push(result.value);
      }
      return { value: next, drop: false };
    }

    if (node === null || typeof node !== "object") {
      return { value: node, drop: false };
    }

    if (isFileNode(node)) {
      const resolved = filesById.get(node.id);
      if (!resolved) return { value: null, drop: true };
      return {
        value: {
          ...node,
          url: resolved.url,
          name: resolved.name,
          alternativeText: resolved.alternativeText,
        },
        drop: false,
      };
    }

    const record = node as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      const result = walk(value);
      next[key] = result.drop ? null : result.value;
    }
    return { value: next, drop: false };
  };

  return walk(blocks).value;
}
