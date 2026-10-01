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

describe("sendMigratedAccountActivation", () => {
  it("sends to the imported admin with the activation link in the body", async () => {
    const h = harness();

    await h.service.sendMigratedAccountActivation({
      to: "contact@ong-exemplu.ro",
      nume: "Ion Popescu",
      ongName: "Asociația Exemplu",
      link: "https://app.crestem-ong.ro/membru/activare?token=abc",
    });

    expect(h.send).toHaveBeenCalledTimes(1);
    const payload = h.send.mock.calls[0][0];
    expect(payload.to).toBe("contact@ong-exemplu.ro");
    expect(payload.subject).toBe(
      "Contul tău Creștem ONG a fost mutat pe noua platformă",
    );
    expect(payload.text).toContain("Ion Popescu");
    expect(payload.text).toContain("Asociația Exemplu");
    expect(payload.text).toContain(
      "https://app.crestem-ong.ro/membru/activare?token=abc",
    );
  });

  it("renders the link as an anchor in the html body", async () => {
    const h = harness();

    await h.service.sendMigratedAccountActivation({
      to: "contact@ong-exemplu.ro",
      nume: "Ion Popescu",
      ongName: "Asociația Exemplu",
      link: "https://app.crestem-ong.ro/membru/activare?token=abc",
    });

    const payload = h.send.mock.calls[0][0];
    expect(payload.html).toContain(
      '<a href="https://app.crestem-ong.ro/membru/activare?token=abc"',
    );
  });
});

describe("sendPlatformUpdateNotice", () => {
  it("tells the imported admin the platform moved and links to login", async () => {
    const h = harness();

    await h.service.sendPlatformUpdateNotice({
      to: "contact@ong-exemplu.ro",
      nume: "Ion Popescu",
      ongName: "Asociația Exemplu",
      link: "https://app.crestem-ong.ro/autentificare",
    });

    expect(h.send).toHaveBeenCalledTimes(1);
    const payload = h.send.mock.calls[0][0];
    expect(payload.to).toBe("contact@ong-exemplu.ro");
    expect(payload.text).toContain("Ion Popescu");
    expect(payload.text).toContain("Asociația Exemplu");
    expect(payload.text).toContain("https://app.crestem-ong.ro/autentificare");
  });

  it("links the privacy policy and the terms to their pages on the frontend", async () => {
    vi.stubEnv("FRONTEND_URL", "https://crestem.ong");
    const h = harness();

    await h.service.sendPlatformUpdateNotice({
      to: "contact@ong-exemplu.ro",
      nume: "Ion Popescu",
      ongName: "Asociația Exemplu",
      link: "https://crestem.ong/autentificare",
    });
    vi.unstubAllEnvs();

    const payload = h.send.mock.calls[0][0];
    expect(payload.html).toContain(
      '<a href="https://crestem.ong/politica-de-confidentialitate" style="color:#00ca86;text-decoration:underline;">Politică de Confidențialitate</a>',
    );
    expect(payload.html).toContain(
      '<a href="https://crestem.ong/termeni-si-conditii" style="color:#00ca86;text-decoration:underline;">Termeni și Condiții</a>',
    );
    expect(payload.text).toContain(
      "Politică de Confidențialitate (https://crestem.ong/politica-de-confidentialitate)",
    );
    expect(payload.text).toContain(
      "Termeni și Condiții (https://crestem.ong/termeni-si-conditii)",
    );
  });
});

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
