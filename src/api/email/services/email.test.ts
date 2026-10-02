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
