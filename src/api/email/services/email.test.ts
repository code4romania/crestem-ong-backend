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

describe("sendAdminEmailChangeConfirmation", () => {
  const args = {
    to: "nou@example.ro",
    nume: "Maria",
    link: "https://app.crestem-ong.ro/schimbare-email?token=abc",
  };

  it("mails the new address with the link and the 7-day validity", async () => {
    const h = harness();
    await h.service.sendAdminEmailChangeConfirmation(args);
    const payload = h.send.mock.calls[0][0];
    expect(payload.to).toBe("nou@example.ro");
    expect(payload.subject).toBe("Confirmă noua adresă de email");
    expect(payload.text).toContain(args.link);
    expect(payload.text).toContain("7 zile");
  });

  it("does not claim the recipient asked for the change", async () => {
    const h = harness();
    await h.service.sendAdminEmailChangeConfirmation(args);
    expect(h.send.mock.calls[0][0].text).not.toContain("Ai cerut");
  });
});

describe("sendEvaluationReminder", () => {
  const args = {
    to: "ana@example.ro",
    nume: "Ana",
    ongName: "Asociația Exemplu",
    link: "https://app.crestem-ong.ro/dashboard/ong-1/evaluari/eval-1",
  };

  it("reminds the member which organization is waiting and links to the evaluation", async () => {
    const h = harness();
    await h.service.sendEvaluationReminder(args);
    const payload = h.send.mock.calls[0][0];
    expect(payload.to).toBe("ana@example.ro");
    expect(payload.subject).toBe(
      "Reamintire: evaluarea pentru Asociația Exemplu te așteaptă",
    );
    expect(payload.text).toContain("Îți reamintim");
    expect(payload.text).toContain(args.link);
    expect(payload.text).not.toContain("Termenul limită");
  });

  it("states the deadline when the round has one", async () => {
    const h = harness();
    await h.service.sendEvaluationReminder({ ...args, deadline: "2026-11-15" });
    expect(h.send.mock.calls[0][0].text).toContain(
      "Termenul limită pentru completare este 15.11.2026.",
    );
  });
});

describe("sendEvaluationInvite", () => {
  it("states the deadline in Romanian display format", async () => {
    const h = harness();
    await h.service.sendEvaluationInvite({
      to: "ana@example.ro",
      nume: "Ana",
      ongName: "Asociația Exemplu",
      link: "https://app.crestem-ong.ro/dashboard/ong-1/evaluari/eval-1",
      deadline: "2026-11-15",
    });
    expect(h.send.mock.calls[0][0].text).toContain(
      "Termenul limită pentru completare este 15.11.2026.",
    );
  });
});
