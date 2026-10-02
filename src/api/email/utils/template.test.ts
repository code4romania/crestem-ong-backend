import { describe, expect, it } from "vitest";
import { renderEmail, termsNote } from "./template";

const LINES = [
  "Bună, Ana,",
  "",
  "Un administrator ți-a creat un cont pe platforma Creștem ONG.",
  "Pentru a-l activa, accesează linkul de mai jos:",
  "",
  "https://crestemong.ro/activare?token=abc",
  "",
  "Linkul este valabil 7 zile.",
];

describe("renderEmail text", () => {
  it("keeps the body lines verbatim", () => {
    expect(renderEmail(LINES).text).toContain(LINES.join("\n"));
  });

  it("appends the sign-off after a blank line", () => {
    expect(renderEmail(["Bună, Ana,"]).text).toBe(
      "Bună, Ana,\n\nO zi bună!\nEchipa Creștem ONG",
    );
  });
});

describe("renderEmail html", () => {
  const { html } = renderEmail(LINES);

  it("groups consecutive lines into one paragraph, split on blank lines", () => {
    expect(html).toContain(
      "Un administrator ți-a creat un cont pe platforma Creștem ONG.<br>Pentru a-l activa, accesează linkul de mai jos:",
    );
    expect(html).toContain("Bună, Ana,");
  });

  it("turns a bare URL line into an anchor showing the URL", () => {
    expect(html).toContain(
      '<a href="https://crestemong.ro/activare?token=abc"',
    );
    expect(html).toContain(">https://crestemong.ro/activare?token=abc</a>");
  });

  it("renders the logo from the frontend origin", () => {
    expect(html).toContain('src="http://localhost:1337/email/logo.png"');
    expect(html).toContain('alt="Creștem ONG"');
  });

  it("renders the sign-off and the footer", () => {
    expect(html).toContain("O zi bună!");
    expect(html).toContain("<strong>Echipa Creștem ONG</strong>");
    expect(html).toContain("Acest email a fost trimis de echipa Creștem ONG.");
    expect(html).toContain(
      "Dacă ați primit acest mesaj din greșeală, vă rugăm să îl ignorați.",
    );
  });

  it("escapes HTML so a name or an ONG name cannot break the markup", () => {
    const { html } = renderEmail(["Bună, <b>Ana</b> & Co,"]);
    expect(html).toContain("Bună, &lt;b&gt;Ana&lt;/b&gt; &amp; Co,");
    expect(html).not.toContain("<b>Ana</b>");
  });

  it("escapes the ampersand inside a link without breaking the href", () => {
    const { html } = renderEmail(["https://crestemong.ro/a?x=1&y=2"]);
    expect(html).toContain('href="https://crestemong.ro/a?x=1&amp;y=2"');
  });

  it("is a full document with a doctype", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });
});

describe("renderEmail links inside a line", () => {
  const line = ["Citește ", { text: "Termenii", href: "https://crestemong.ro/termeni?a=1&b=2" }, "."];

  it("renders a link segment as an anchor on its text", () => {
    expect(renderEmail([line]).html).toContain(
      'Citește <a href="https://crestemong.ro/termeni?a=1&amp;b=2" style="color:#00ca86;text-decoration:underline;">Termenii</a>.',
    );
  });

  it("keeps the URL in parentheses in the text version", () => {
    expect(renderEmail([line]).text).toContain(
      "Citește Termenii (https://crestemong.ro/termeni?a=1&b=2).",
    );
  });

  it("never parses link markup out of a string line", () => {
    const { html } = renderEmail(["[Click](https://evil.example)"]);
    expect(html).not.toContain('href="https://evil.example"');
  });
});

describe("termsNote", () => {
  const { text, html } = renderEmail(["Bună, Ana,", "", termsNote()]);

  it("links the privacy policy and the terms on the frontend origin", () => {
    expect(html).toContain(
      '<a href="http://localhost:1337/politica-de-confidentialitate" style="color:#00ca86;text-decoration:underline;">Politica de Confidențialitate</a>',
    );
    expect(html).toContain(
      '<a href="http://localhost:1337/termeni-si-conditii" style="color:#00ca86;text-decoration:underline;">Termenii și Condițiile</a>',
    );
  });

  it("reads as one sentence in the text version", () => {
    expect(text).toContain(
      "Notă: Prin activarea contului și continuarea utilizării platformei, confirmi că ai luat la cunoștință Politica de Confidențialitate (http://localhost:1337/politica-de-confidentialitate) și Termenii și Condițiile (http://localhost:1337/termeni-si-conditii).",
    );
  });

  it("sits in a body paragraph, styled like the rest of the body", () => {
    expect(html).toMatch(/<p style="margin:0 0 20px 0;[^"]*font-size:16px;[^"]*">Notă: /);
  });
});
