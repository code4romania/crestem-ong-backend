import { describe, expect, it, vi } from "vitest";
import emailService from "./email";

function harness() {
  const send = vi.fn(async () => {});
  const strapi = {
    plugin: (name: string) => {
      expect(name).toBe("email");
      return { service: () => ({ send }) };
    },
  } as any;
  return { service: emailService({ strapi }), send };
}

describe("sendMemberAdded", () => {
  it("tells an existing user which organization added them and links to login", async () => {
    const h = harness();

    await h.service.sendMemberAdded({
      to: "ion.popescu@ong.ro",
      nume: "Ion Popescu",
      ongName: "Asociația Exemplu",
      link: "https://app.crestem-ong.ro/autentificare",
    });

    expect(h.send).toHaveBeenCalledTimes(1);
    const payload = h.send.mock.calls[0][0];
    expect(payload.to).toBe("ion.popescu@ong.ro");
    expect(payload.subject).toBe(
      "Ai fost adăugat în organizația Asociația Exemplu",
    );
    expect(payload.text).toContain("Ion Popescu");
    expect(payload.text).toContain("https://app.crestem-ong.ro/autentificare");
  });
});

const TERMS_NOTE = "Notă: Prin activarea contului";

describe("sendAccountActivation", () => {
  const args = {
    to: "maria@example.ro",
    nume: "Maria",
    roleLabel: "mentor",
    link: "https://app.crestem-ong.ro/activare?token=abc",
  };

  it("ends a mentor invitation with the terms note", async () => {
    const h = harness();
    await h.service.sendAccountActivation({ ...args, includeTermsNote: true });
    const { text, html } = h.send.mock.calls[0][0];
    expect(text).toContain(TERMS_NOTE);
    expect(html).toContain("/politica-de-confidentialitate");
    expect(html).toContain("/termeni-si-conditii");
  });

  it("leaves the note out of a staff invitation", async () => {
    const h = harness();
    await h.service.sendAccountActivation({ ...args, roleLabel: "editor FDSC" });
    expect(h.send.mock.calls[0][0].text).not.toContain(TERMS_NOTE);
  });
});

describe("sendMemberActivation", () => {
  it("ends with the terms note", async () => {
    const h = harness();
    await h.service.sendMemberActivation({
      to: "ion@example.ro",
      nume: "Ion",
      ongName: "Asociația Exemplu",
      link: "https://app.crestem-ong.ro/activare?token=abc",
    });
    const { text } = h.send.mock.calls[0][0];
    expect(text).toContain(TERMS_NOTE);
    expect(text.indexOf(TERMS_NOTE)).toBeGreaterThan(
      text.indexOf("ignori acest email"),
    );
  });
});
