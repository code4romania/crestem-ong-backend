import { describe, expect, it } from "vitest";
import { proposalMessage } from "./mailer";

const base = {
  to: "mihai@example.ro",
  nume: "Mihai",
  ongName: "Asociația Test",
  initiatorName: "Ana Admin",
  fromFdsc: false,
  isNewAccount: false,
  link: "https://crestem.test/transfer-admin?token=abc",
  expiresAt: "2026-10-01T10:00:00.000Z",
};

describe("proposalMessage", () => {
  it("names the ONG, the initiator and carries the link (US-1 AC4)", () => {
    const message = proposalMessage(base);
    expect(message.subject).toBe("Ana Admin te propune administrator al organizației Asociația Test");
    expect(message.text).toContain("Asociația Test");
    expect(message.text).toContain("Ana Admin");
    expect(message.text).toContain(base.link);
    expect(message.text).toContain("01.10.2026");
  });

  it("says explicitly that an FDSC proposal comes from FDSC (US-5 step 5)", () => {
    const message = proposalMessage({ ...base, fromFdsc: true });
    expect(message.subject).toContain("FDSC");
    expect(message.text).toContain("Echipa FDSC te propune");
    expect(message.text).not.toContain("Ana Admin");
  });

  it("tells a new account that accepting sets its password", () => {
    expect(proposalMessage({ ...base, isNewAccount: true }).text).toContain("îți setezi parola");
  });
});
