/**
 * `dataPublicarii` is set the first time an article is published and never
 * recleared — not on withdrawal, not on republish. It is the date the library
 * shows and orders by, and an editor fixing a typo should not shuffle an
 * article back to the top of "Cele mai recente".
 */
export function nextDataPublicarii({
  stare,
  current,
  now,
}: {
  stare: "schita" | "publicat";
  current: string | null;
  now: Date;
}): string | null {
  if (current) return current;
  return stare === "publicat" ? now.toISOString() : null;
}
