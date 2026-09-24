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
    expect(payload.subject).toBe("Contul tău Creștem ONG a fost mutat pe noua platformă");
    expect(payload.text).toContain("Ion Popescu");
    expect(payload.text).toContain("Asociația Exemplu");
    expect(payload.text).toContain("https://app.crestem-ong.ro/membru/activare?token=abc");
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
