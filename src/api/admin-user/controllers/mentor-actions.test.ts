import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  resendMentorInvitation: vi.fn(),
  changeMentorEmail: vi.fn(),
  deleteMentor: vi.fn(),
}));
vi.mock("../services/mentor-admin", () => service);

import controller from "./admin-user";

function makeCtx(overrides: Record<string, any> = {}) {
  return {
    state: { user: { role: { type: "super-admin" } } },
    params: { documentId: "doc-1" },
    request: { body: { email: "nou@example.com" } },
    unauthorized: vi.fn(() => "unauthorized"),
    forbidden: vi.fn(() => "forbidden"),
    notFound: vi.fn(() => "notFound"),
    badRequest: vi.fn(() => "badRequest"),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.resetAllMocks();
  (globalThis as any).strapi = {};
});

describe("mentor admin actions", () => {
  const actions = [
    ["resendInvite", service.resendMentorInvitation],
    ["changeEmail", service.changeMentorEmail],
    ["remove", service.deleteMentor],
  ] as const;

  it.each(actions)("%s rejects a missing session", async (name, fn) => {
    const ctx = makeCtx({ state: {} });
    await (controller as any)[name](ctx);
    expect(ctx.unauthorized).toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it.each(actions)("%s forbids the editor", async (name, fn) => {
    const ctx = makeCtx({ state: { user: { role: { type: "editor-fdsc" } } } });
    await (controller as any)[name](ctx);
    expect(ctx.forbidden).toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  it.each(actions)("%s maps service errors to 404 / 400", async (name, fn) => {
    fn.mockResolvedValueOnce({ error: "lipsă", status: 404 });
    const ctx = makeCtx();
    await (controller as any)[name](ctx);
    expect(ctx.notFound).toHaveBeenCalledWith("lipsă");

    fn.mockResolvedValueOnce({ error: "nu", status: 400 });
    const ctx2 = makeCtx();
    await (controller as any)[name](ctx2);
    expect(ctx2.badRequest).toHaveBeenCalledWith("nu");
  });

  it("resendInvite reports whether the email went out", async () => {
    service.resendMentorInvitation.mockResolvedValueOnce({ emailSent: true });
    expect(await controller.resendInvite(makeCtx())).toEqual({
      message: "Invitația a fost retrimisă.",
      emailSent: true,
    });
    service.resendMentorInvitation.mockResolvedValueOnce({ emailSent: false });
    expect(await controller.resendInvite(makeCtx())).toEqual({
      message: "Invitația a fost regenerată, dar emailul nu a putut fi trimis.",
      emailSent: false,
    });
  });

  it("changeEmail rejects an invalid body without calling the service", async () => {
    const ctx = makeCtx({ request: { body: { email: "nu-e-email" } } });
    await controller.changeEmail(ctx);
    expect(ctx.badRequest).toHaveBeenCalledWith(
      "Date invalide: ",
      expect.anything(),
    );
    expect(service.changeMentorEmail).not.toHaveBeenCalled();
  });

  it("changeEmail returns the message for each mode", async () => {
    service.changeMentorEmail.mockResolvedValueOnce({
      mode: "invite-resent",
      emailSent: true,
    });
    expect(await controller.changeEmail(makeCtx())).toEqual({
      message: "Adresa a fost schimbată și invitația a fost retrimisă.",
      mode: "invite-resent",
      emailSent: true,
    });
    expect(service.changeMentorEmail).toHaveBeenCalledWith(
      (globalThis as any).strapi,
      "doc-1",
      "nou@example.com",
    );

    service.changeMentorEmail.mockResolvedValueOnce({
      mode: "confirmation-sent",
      emailSent: true,
    });
    expect(await controller.changeEmail(makeCtx())).toMatchObject({
      message: "Am trimis un link de confirmare pe noua adresă.",
      mode: "confirmation-sent",
    });
  });

  it("changeEmail answers 200 with emailSent false when the mail failed", async () => {
    service.changeMentorEmail.mockResolvedValueOnce({
      mode: "confirmation-sent",
      emailSent: false,
    });
    expect(await controller.changeEmail(makeCtx())).toEqual({
      message: "Emailul nu a putut fi trimis. Încearcă din nou.",
      mode: "confirmation-sent",
      emailSent: false,
    });
  });

  it("changeEmail says the invitation failed when a pending swap could not mail", async () => {
    service.changeMentorEmail.mockResolvedValueOnce({
      mode: "invite-resent",
      emailSent: false,
    });
    expect(await controller.changeEmail(makeCtx())).toEqual({
      message:
        "Adresa a fost schimbată, dar invitația nu a putut fi trimisă. Folosește „Retrimite invitația”.",
      mode: "invite-resent",
      emailSent: false,
    });
  });

  it("remove returns the message for each mode", async () => {
    service.deleteMentor.mockResolvedValueOnce({ mode: "deleted" });
    expect(await controller.remove(makeCtx())).toEqual({
      message: "Invitația a fost ștearsă.",
      mode: "deleted",
    });
    service.deleteMentor.mockResolvedValueOnce({ mode: "anonymized" });
    expect(await controller.remove(makeCtx())).toEqual({
      message: "Persoana resursă a fost ștearsă.",
      mode: "anonymized",
    });
  });
});
