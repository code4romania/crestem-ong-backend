import { describe, expect, it } from "vitest";
import { renderEmail } from "./template";

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
