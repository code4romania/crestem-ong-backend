/**
 * Wraps the plain-text body of a transactional email in the branded HTML
 * layout: logo header, rule, body, sign-off, rule, footer.
 *
 * Callers keep passing the same array of lines they used to join with `\n`
 * for the text-only version — a blank line starts a new paragraph, and
 * consecutive lines become one paragraph broken with `<br>`.
 */

const SIGN_OFF_GREETING = "O zi bună!";
const SIGN_OFF_TEAM = "Echipa Creștem ONG";
const FOOTER_LINES = [
  "Acest email a fost trimis de echipa Creștem ONG.",
  "Dacă ați primit acest mesaj din greșeală, vă rugăm să îl ignorați.",
];

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const COLOR_PAGE = "#f4f4f5";
const COLOR_CARD = "#ffffff";
const COLOR_TEXT = "#1f2937";
const COLOR_MUTED = "#9ca3af";
const COLOR_RULE = "#e4e4e7";
const COLOR_LINK = "#00ca86";

/** Matches a line that is nothing but a URL, so it can be linkified. */
const BARE_URL = /^https?:\/\/\S+$/;

function frontendOrigin(): string {
  return process.env.FRONTEND_URL || "http://localhost:1337";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Groups lines into paragraphs, using blank lines as the separator. */
function toParagraphs(lines: string[]): string[][] {
  const paragraphs: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) paragraphs.push(current);

  return paragraphs;
}

function renderLine(line: string): string {
  const escaped = escapeHtml(line);
  if (!BARE_URL.test(line)) return escaped;
  return `<a href="${escaped}" style="color:${COLOR_LINK};text-decoration:underline;word-break:break-all;">${escaped}</a>`;
}

function renderParagraph(lines: string[]): string {
  const body = lines.map(renderLine).join("<br>");
  return `<p style="margin:0 0 20px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${COLOR_TEXT};">${body}</p>`;
}

function rule(): string {
  return `<hr style="border:0;border-top:1px solid ${COLOR_RULE};margin:0;">`;
}

function renderHtml(lines: string[]): string {
  const paragraphs = toParagraphs(lines).map(renderParagraph).join("\n          ");
  const logo = `${frontendOrigin()}/email/logo.png`;
  const footer = FOOTER_LINES.map(escapeHtml).join("<br>");

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Creștem ONG</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR_PAGE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR_PAGE};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${COLOR_CARD};border-radius:16px;">
        <tr>
          <td align="center" style="padding:40px 40px 32px 40px;">
            <img src="${logo}" width="280" alt="Creștem ONG" style="display:block;width:280px;max-width:100%;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">${rule()}</td>
        </tr>
        <tr>
          <td style="padding:32px 40px 8px 40px;">
          ${paragraphs}
          <p style="margin:32px 0 0 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${COLOR_TEXT};">${escapeHtml(SIGN_OFF_GREETING)}<br><strong>${escapeHtml(SIGN_OFF_TEAM)}</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 0 40px;">${rule()}</td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 40px 32px 40px;">
            <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${COLOR_MUTED};text-align:center;">${footer}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export interface RenderedEmail {
  text: string;
  html: string;
}

export function renderEmail(lines: string[]): RenderedEmail {
  return {
    text: [...lines, "", SIGN_OFF_GREETING, SIGN_OFF_TEAM].join("\n"),
    html: renderHtml(lines),
  };
}
