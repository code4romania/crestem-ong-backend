/**
 * Upload references inside blocks are plain JSON, so Strapi's Media Library
 * cannot see that a file is in use and would let someone delete it out from
 * under a live page. Walking the tree for those references lets the controller
 * mirror them into a real `media` field, which the admin panel does understand.
 *
 * A reference is an object carrying both a numeric `id` and a string `url` —
 * the shape `uploadPageImageAction` stores. A bare `{ id }`, such as a selected
 * person, is not a file.
 */
export function collectFileIds(blocks: unknown): number[] {
  const found = new Set<number>();

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node === null || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    if (typeof record.id === "number" && typeof record.url === "string") {
      found.add(record.id);
    }

    Object.values(record).forEach(walk);
  };

  walk(blocks);
  return [...found];
}
