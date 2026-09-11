/** Visible text of a TipTap-produced HTML string, for length checks that
 * shouldn't be eaten into by markup (bold/lists/links etc). */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
