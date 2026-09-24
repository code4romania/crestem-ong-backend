import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptNewAccount,
  acceptTransfer,
  cancelForOngDeletion,
  cancelTransfer,
  createTransfer,
  declineNewAccount,
  declineTransfer,
  findIncomingTransfer,
  findPendingForOng,
  previewTransfer,
  resendTransfer,
  type Deps,
  type OngRecord,
  type TransferMailer,
  type TransferRecord,
  type TransferRepo,
  type UserRecord,
} from "./transfer-flow";
import { TRANSFER_MESSAGES } from "../utils/messages";

/**
 * In-memory stand-in for the Strapi repository. `transaction` snapshots every
 * table and restores it when the callback throws, like a database rollback.
 */
function world() {
  let seq = 100;
  const users = new Map<string, UserRecord>();
  const ongs = new Map<string, OngRecord>();
  const transfers = new Map<string, TransferRecord & { tokenHash: string }>();
  const memberRoleRows = new Set<string>(); // `${user}|${ong}`
  const passwords = new Map<string, string>();
  const clock = { now: new Date("2026-09-24T10:00:00.000Z") };
  let failInsideSwap = false;

  const clone = <T>(v: T): T => structuredClone(v);
  const addUser = (u: Partial<UserRecord> & { documentId: string }) => {
    const user: UserRecord = {
      id: seq++,
      nume: u.documentId,
      email: `${u.documentId}@example.ro`,
      accountStatus: "active",
      role: { type: "ngo-member" },
      ong: [],
      ...u,
    };
    users.set(user.documentId, user);
    return user;
  };

  const hydrate = (t: TransferRecord & { tokenHash: string }) => ({
    ...clone(t),
    ong: t.ong ? clone(ongs.get(t.ong.documentId) ?? t.ong) : null,
    recipient: t.recipient ? clone(users.get(t.recipient.documentId) ?? null) : null,
    initiator: t.initiator ? clone(users.get(t.initiator.documentId) ?? t.initiator) : null,
  });

  const repo: TransferRepo = {
    async transaction(fn) {
      const snapshot = {
        users: clone([...users]),
        transfers: clone([...transfers]),
        rows: [...memberRoleRows],
        passwords: [...passwords],
      };
      try {
        return await fn();
      } catch (error) {
        users.clear();
        snapshot.users.forEach(([k, v]) => users.set(k, v));
        transfers.clear();
        snapshot.transfers.forEach(([k, v]) => transfers.set(k, v));
        memberRoleRows.clear();
        snapshot.rows.forEach((r) => memberRoleRows.add(r));
        passwords.clear();
        snapshot.passwords.forEach(([k, v]) => passwords.set(k, v));
        throw error;
      }
    },
    async findTransferByHash(hash) {
      const t = [...transfers.values()].find((x) => x.tokenHash === hash);
      return t ? hydrate(t) : null;
    },
    async findPendingForOng(ong) {
      return [...transfers.values()]
        .filter((t) => t.ong?.documentId === ong && t.transferStatus === "pending")
        .map(hydrate);
    },
    async findPendingForRecipient(user) {
      return [...transfers.values()]
        .filter((t) => t.recipient?.documentId === user && t.transferStatus === "pending")
        .map(hydrate);
    },
    async findPendingForEmail(email) {
      return [...transfers.values()]
        .filter((t) => t.recipientEmail === email && t.transferStatus === "pending")
        .map(hydrate);
    },
    async createTransfer(data) {
      const t = {
        id: seq++,
        documentId: `transfer-${seq}`,
        transferStatus: "pending" as const,
        initiatedBy: data.initiatedBy,
        expiresAt: data.expiresAt.toISOString(),
        ong: clone(ongs.get(data.ongDocumentId)!),
        initiator: clone(users.get(data.initiatorDocumentId)!),
        previousAdmin: data.previousAdminDocumentId
          ? clone(users.get(data.previousAdminDocumentId)!)
          : null,
        recipient: clone(users.get(data.recipientDocumentId)!),
        recipientEmail: data.recipientEmail,
        recipientName: data.recipientName,
        createdPendingAccount: data.createdPendingAccount,
        tokenCiphertext: data.tokenCiphertext,
        tokenHash: data.tokenHash,
      };
      transfers.set(t.documentId, t);
      return hydrate(t);
    },
    async resolveTransfer(transfer, status) {
      const t = transfers.get(transfer.documentId)!;
      if (t.transferStatus !== "pending") return false;
      t.transferStatus = status;
      return true;
    },
    async findOng(id) {
      return clone(ongs.get(id) ?? null);
    },
    async findUser(id) {
      return clone(users.get(id) ?? null);
    },
    async findUserByEmail(email) {
      return clone([...users.values()].find((u) => u.email.toLowerCase() === email) ?? null);
    },
    async findOngAdmin(ong) {
      return clone(
        [...users.values()].find(
          (u) => u.role?.type === "ngo-admin" && (u.ong ?? []).some((o) => o.documentId === ong),
        ) ?? null,
      );
    },
    async createPendingAccount({ nume, email }) {
      return clone(
        addUser({
          documentId: `new-${seq}`,
          nume,
          email,
          accountStatus: "pending",
          role: { type: "individual" },
          ong: [],
        }),
      );
    },
    async activateAccount(user, password) {
      users.get(user.documentId)!.accountStatus = "active";
      passwords.set(user.documentId, password);
    },
    async deleteUser(user) {
      users.delete(user.documentId);
    },
    async makeAdmin(user, ong) {
      if (failInsideSwap) throw new Error("database went away");
      const u = users.get(user.documentId)!;
      u.role = { type: "ngo-admin" };
      u.ong = [{ documentId: ong }];
      memberRoleRows.delete(`${user.documentId}|${ong}`);
    },
    async removeFromOng(user, ong) {
      const u = users.get(user.documentId)!;
      u.ong = (u.ong ?? []).filter((o) => o.documentId !== ong);
      memberRoleRows.delete(`${user.documentId}|${ong}`);
      if (u.ong.length === 0) u.role = { type: "individual" };
    },
  };

  const mailer = {
    proposal: vi.fn(async () => {}),
    fdscNotice: vi.fn(async () => {}),
    accepted: vi.fn(async () => {}),
    replaced: vi.fn(async () => {}),
    declined: vi.fn(async () => {}),
    cancelled: vi.fn(async () => {}),
    cancelledByFdsc: vi.fn(async () => {}),
    autoCancelled: vi.fn(async () => {}),
  } satisfies TransferMailer;

  const deps: Deps = { repo, mailer, now: () => clock.now, log: () => {} };

  // A standard ONG: admin + one active and one pending member.
  const ong: OngRecord = { documentId: "ong-1", name: "Asociația Test", ngoStatus: "active" };
  ongs.set(ong.documentId, ong);
  const admin = addUser({ documentId: "admin-1", nume: "Ana Admin", role: { type: "ngo-admin" }, ong: [{ documentId: "ong-1" }] });
  const member = addUser({ documentId: "member-1", nume: "Mihai Membru", ong: [{ documentId: "ong-1" }] });
  memberRoleRows.add("member-1|ong-1");
  memberRoleRows.add("admin-1|ong-1");
  addUser({ documentId: "pending-1", accountStatus: "pending", ong: [{ documentId: "ong-1" }] });
  const fdsc = addUser({ documentId: "fdsc-1", nume: "Florin FDSC", role: { type: "super-admin" }, ong: [] });

  /** Captures the raw token from the proposal email's link. */
  const lastToken = () => {
    const calls = mailer.proposal.mock.calls as unknown as Array<[{ link: string }]>;
    const link = calls[calls.length - 1][0].link;
    return decodeURIComponent(link.split("token=")[1]);
  };

  return {
    deps, users, ongs, transfers, memberRoleRows, passwords, clock, mailer,
    ong, admin, member, fdsc, addUser, lastToken,
    breakSwap: () => { failInsideSwap = true; },
  };
}

type World = ReturnType<typeof world>;

const byAdmin = (w: World, target: any) =>
  createTransfer(w.deps, {
    ong: w.ong,
    initiator: { documentId: w.admin.documentId, nume: w.admin.nume },
    initiatedBy: "ngo-admin",
    target,
  });

const byFdsc = (w: World, target: any) =>
  createTransfer(w.deps, {
    ong: w.ong,
    initiator: { documentId: w.fdsc.documentId, nume: w.fdsc.nume },
    initiatedBy: "fdsc",
    target,
  });

const toMember = { mode: "member", memberDocumentId: "member-1" };
const toNewEmail = { mode: "email", nume: "Nora Nouă", email: "  Nora@Example.RO " };

describe("createTransfer", () => {
  let w: World;
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    w = world();
  });

  it("creates one pending transfer for an active member, 7 days out, and emails only the recipient", async () => {
    const result = await byAdmin(w, toMember);
    expect("data" in result).toBe(true);
    const pending = [...w.transfers.values()].filter((t) => t.transferStatus === "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].expiresAt).toBe("2026-10-01T10:00:00.000Z");
    expect(w.mailer.proposal).toHaveBeenCalledTimes(1);
    expect(w.mailer.proposal.mock.calls[0][0]).toMatchObject({
      to: "member-1@example.ro",
      ongName: "Asociația Test",
      initiatorName: "Ana Admin",
      fromFdsc: false,
    });
    // US-1 AC5: nothing moved yet.
    expect(w.users.get("admin-1")!.role?.type).toBe("ngo-admin");
    expect(w.users.get("member-1")!.role?.type).toBe("ngo-member");
  });

  it("refuses a second transfer while one is pending (US-1 AC6)", async () => {
    await byAdmin(w, toMember);
    expect(await byAdmin(w, toNewEmail)).toEqual({ error: TRANSFER_MESSAGES.ALREADY_PENDING });
    expect(w.mailer.proposal).toHaveBeenCalledTimes(1);
  });

  it("allows a new transfer once the previous one expired", async () => {
    await byAdmin(w, toMember);
    w.clock.now = new Date("2026-10-02T00:00:00.000Z");
    expect("data" in (await byAdmin(w, toMember))).toBe(true);
  });

  it("refuses a pending member with its own message and creates nothing", async () => {
    const result = await byAdmin(w, { mode: "member", memberDocumentId: "pending-1" });
    expect(result).toEqual({ error: TRANSFER_MESSAGES.PENDING_MEMBER });
    expect(w.transfers.size).toBe(0);
  });

  it("refuses a member that is no longer in the ONG (US-1 A4)", async () => {
    w.users.get("member-1")!.ong = [];
    expect(await byAdmin(w, toMember)).toEqual({ error: TRANSFER_MESSAGES.MEMBER_NOT_FOUND });
  });

  it("refuses when the ONG is not active", async () => {
    w.ong.ngoStatus = "blocked";
    expect(await byAdmin(w, toMember)).toEqual({ error: TRANSFER_MESSAGES.ONG_NOT_ACTIVE });
  });

  it("creates exactly one pending account for an unknown, normalized email (US-2 AC3)", async () => {
    const result = await byAdmin(w, toNewEmail);
    expect("data" in result).toBe(true);
    const created = [...w.users.values()].filter((u) => u.email === "nora@example.ro");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      accountStatus: "pending",
      role: { type: "individual" },
      ong: [],
      nume: "Nora Nouă",
    });
    expect(w.mailer.proposal.mock.calls[0][0]).toMatchObject({ isNewAccount: true });
  });

  it("continues as US-1 when the email belongs to an active member (US-2 A4)", async () => {
    const result = await byAdmin(w, { mode: "email", nume: "x", email: "MEMBER-1@example.ro" });
    expect("data" in result && result.data.transfer.createdPendingAccount).toBe(false);
    expect(w.users.size).toBe(4);
  });

  it("refuses existing accounts outside the ONG with the generic message and no side effects", async () => {
    w.addUser({ documentId: "loner", email: "loner@example.ro", role: { type: "individual" }, ong: [] });
    const result = await byAdmin(w, { mode: "email", nume: "x", email: "loner@example.ro" });
    expect(result).toEqual({ error: TRANSFER_MESSAGES.NOT_ELIGIBLE });
    expect(w.transfers.size).toBe(0);
    expect(w.mailer.proposal).not.toHaveBeenCalled();
  });

  it("frees the address of an expired invite before judging it again", async () => {
    await byAdmin(w, toNewEmail);
    w.clock.now = new Date("2026-10-02T00:00:00.000Z");
    const again = await byAdmin(w, toNewEmail);
    expect("data" in again).toBe(true);
    expect([...w.users.values()].filter((u) => u.email === "nora@example.ro")).toHaveLength(1);
  });

  it("FDSC transfer informs the current admin and marks the proposal as from FDSC (US-5)", async () => {
    await byFdsc(w, toMember);
    expect(w.mailer.proposal.mock.calls[0][0]).toMatchObject({ fromFdsc: true });
    expect(w.mailer.fdscNotice).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin-1@example.ro" }),
    );
  });

  it("FDSC cannot propose the current admin", async () => {
    const result = await byFdsc(w, { mode: "email", nume: "x", email: "admin-1@example.ro" });
    expect(result).toEqual({ error: TRANSFER_MESSAGES.NOT_ELIGIBLE });
  });
});

describe("resend and cancel", () => {
  let w: World;
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    w = world();
  });

  it("resends the identical link without moving the deadline (US-4 A1, AC3)", async () => {
    await byAdmin(w, toMember);
    const first = w.mailer.proposal.mock.calls[0][0];
    const transfer = (await findPendingForOng(w.deps, "ong-1"))!;
    w.clock.now = new Date("2026-09-28T10:00:00.000Z");
    await resendTransfer(w.deps, transfer);
    const second = w.mailer.proposal.mock.calls[1][0];
    expect(second.link).toBe(first.link);
    expect(second.expiresAt).toBe(first.expiresAt);
  });

  it("cancel invalidates the link at once and allows a new transfer (US-4 AC1, AC2)", async () => {
    await byAdmin(w, toMember);
    const token = w.lastToken();
    const transfer = (await findPendingForOng(w.deps, "ong-1"))!;
    await cancelTransfer(w.deps, transfer, "admin-1", false);
    expect(await previewTransfer(w.deps, token)).toEqual({ valid: false, reason: "resolved" });
    expect(w.mailer.cancelled).toHaveBeenCalledTimes(1);
    expect("data" in (await byAdmin(w, toMember))).toBe(true);
  });

  it("cancelling an invite deletes the never-activated account it created (US-2 AC4)", async () => {
    await byAdmin(w, toNewEmail);
    const transfer = (await findPendingForOng(w.deps, "ong-1"))!;
    await cancelTransfer(w.deps, transfer, "admin-1", false);
    expect([...w.users.values()].some((u) => u.email === "nora@example.ro")).toBe(false);
    // Nobody with an active account to inform.
    expect(w.mailer.cancelled).not.toHaveBeenCalled();
  });

  it("FDSC cancelling the admin's own transfer tells that admin (D6)", async () => {
    await byAdmin(w, toMember);
    const transfer = (await findPendingForOng(w.deps, "ong-1"))!;
    await cancelTransfer(w.deps, transfer, "fdsc-1", true);
    expect(w.mailer.cancelledByFdsc).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin-1@example.ro" }),
    );
  });

  it("expiry on first read deletes the invite's pending account", async () => {
    await byAdmin(w, toNewEmail);
    w.clock.now = new Date("2026-10-01T10:00:00.000Z");
    expect(await findPendingForOng(w.deps, "ong-1")).toBeNull();
    expect([...w.users.values()].some((u) => u.email === "nora@example.ro")).toBe(false);
  });

  it("keeps an expired invite's account that got a membership of its own meanwhile", async () => {
    await byAdmin(w, toNewEmail);
    const nora = [...w.users.values()].find((u) => u.email === "nora@example.ro")!;
    nora.ong = [{ documentId: "ong-2" }];
    w.clock.now = new Date("2026-10-02T00:00:00.000Z");
    await findPendingForOng(w.deps, "ong-1");
    expect(w.users.has(nora.documentId)).toBe(true);
  });

  it("ONG deletion cancels the pending transfer silently", async () => {
    await byAdmin(w, toNewEmail);
    await cancelForOngDeletion(w.deps, "ong-1");
    expect([...w.transfers.values()][0].transferStatus).toBe("cancelled");
    expect([...w.users.values()].some((u) => u.email === "nora@example.ro")).toBe(false);
    expect(w.mailer.cancelled).not.toHaveBeenCalled();
  });
});

describe("accept", () => {
  let w: World;
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    w = world();
  });

  it("moves the role: recipient admin, old admin individual, member rows gone (US-3 AC1–3)", async () => {
    await byAdmin(w, toMember);
    const result = await acceptTransfer(w.deps, w.lastToken(), "member-1");
    expect("data" in result).toBe(true);
    expect(w.users.get("member-1")).toMatchObject({
      role: { type: "ngo-admin" },
      ong: [{ documentId: "ong-1" }],
    });
    expect(w.users.get("admin-1")).toMatchObject({ role: { type: "individual" }, ong: [] });
    expect(w.memberRoleRows.has("member-1|ong-1")).toBe(false);
    expect(w.memberRoleRows.has("admin-1|ong-1")).toBe(false);
    expect([...w.transfers.values()][0].transferStatus).toBe("accepted");
    expect(w.mailer.accepted).toHaveBeenCalledTimes(1);
    expect(w.mailer.replaced).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin-1@example.ro", otherName: "Mihai Membru" }),
    );
  });

  it("a second click does not move anything twice (US-3 AC5)", async () => {
    await byAdmin(w, toMember);
    const token = w.lastToken();
    await acceptTransfer(w.deps, token, "member-1");
    expect(await acceptTransfer(w.deps, token, "member-1")).toEqual({
      error: TRANSFER_MESSAGES.INVALID_LINK,
    });
    expect(w.mailer.accepted).toHaveBeenCalledTimes(1);
  });

  it("two concurrent accepts move the role once", async () => {
    await byAdmin(w, toMember);
    const token = w.lastToken();
    const results = await Promise.all([
      acceptTransfer(w.deps, token, "member-1"),
      acceptTransfer(w.deps, token, "member-1"),
    ]);
    expect(results.filter((r) => "error" in r)).toHaveLength(1);
    expect(w.mailer.accepted).toHaveBeenCalledTimes(1);
  });

  it("an error inside the swap leaves everything as before (US-3 AC4)", async () => {
    await byAdmin(w, toMember);
    w.breakSwap();
    await expect(acceptTransfer(w.deps, w.lastToken(), "member-1")).rejects.toThrow();
    expect([...w.transfers.values()][0].transferStatus).toBe("pending");
    expect(w.users.get("admin-1")!.role?.type).toBe("ngo-admin");
    expect(w.users.get("member-1")!.role?.type).toBe("ngo-member");
  });

  it("refuses another signed-in account (US-3 A3)", async () => {
    await byAdmin(w, toMember);
    expect(await acceptTransfer(w.deps, w.lastToken(), "admin-1")).toEqual({
      error: TRANSFER_MESSAGES.WRONG_ACCOUNT,
    });
  });

  it("refuses an expired transfer (US-4 AC4)", async () => {
    await byAdmin(w, toMember);
    w.clock.now = new Date("2026-10-05T00:00:00.000Z");
    expect(await acceptTransfer(w.deps, w.lastToken(), "member-1")).toEqual({
      error: TRANSFER_MESSAGES.INVALID_LINK,
    });
    expect(w.users.get("admin-1")!.role?.type).toBe("ngo-admin");
  });

  it("cancels and notifies when the recipient left the ONG meanwhile (US-3 A5)", async () => {
    await byAdmin(w, toMember);
    w.users.get("member-1")!.ong = [];
    expect(await acceptTransfer(w.deps, w.lastToken(), "member-1")).toEqual({
      error: TRANSFER_MESSAGES.RECIPIENT_REMOVED,
    });
    expect([...w.transfers.values()][0].transferStatus).toBe("cancelled");
    expect(w.mailer.autoCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin-1@example.ro" }),
    );
  });

  it("cancels when the ONG was deleted meanwhile (US-3 A4)", async () => {
    await byAdmin(w, toMember);
    w.ong.ngoStatus = "deleted";
    expect(await acceptTransfer(w.deps, w.lastToken(), "member-1")).toEqual({
      error: TRANSFER_MESSAGES.ONG_DELETED,
    });
    expect([...w.transfers.values()][0].transferStatus).toBe("cancelled");
  });

  it("keeps the transfer pending while the ONG is blocked (D5)", async () => {
    await byAdmin(w, toMember);
    w.ong.ngoStatus = "blocked";
    expect(await acceptTransfer(w.deps, w.lastToken(), "member-1")).toEqual({
      error: TRANSFER_MESSAGES.ONG_NOT_ACTIVE,
    });
    expect([...w.transfers.values()][0].transferStatus).toBe("pending");
  });

  it("a new account sets its password and becomes admin in the same step (US-3 step 8)", async () => {
    await byAdmin(w, toNewEmail);
    const token = w.lastToken();
    expect(await previewTransfer(w.deps, token)).toMatchObject({
      valid: true,
      recipientType: "new",
      recipientEmailMasked: "n***@example.ro",
    });
    const result = await acceptNewAccount(w.deps, token, "Parola#123");
    expect("data" in result).toBe(true);
    const nora = [...w.users.values()].find((u) => u.email === "nora@example.ro")!;
    expect(nora).toMatchObject({ accountStatus: "active", role: { type: "ngo-admin" } });
    expect(w.passwords.get(nora.documentId)).toBe("Parola#123");
    expect(w.users.get("admin-1")!.role?.type).toBe("individual");
  });

  it("accept-new refuses an account that already has a password", async () => {
    await byAdmin(w, toMember);
    expect(await acceptNewAccount(w.deps, w.lastToken(), "Parola#123")).toEqual({
      error: TRANSFER_MESSAGES.ACCOUNT_ALREADY_ACTIVE,
    });
  });

  it("FDSC transfer on an ONG with no admin still works", async () => {
    w.users.delete("admin-1");
    await byFdsc(w, toMember);
    expect(w.mailer.fdscNotice).not.toHaveBeenCalled();
    expect("data" in (await acceptTransfer(w.deps, w.lastToken(), "member-1"))).toBe(true);
    expect(w.mailer.replaced).not.toHaveBeenCalled();
  });
});

describe("decline", () => {
  let w: World;
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    w = world();
  });

  it("leaves the old admin in place and tells them (US-3 A1, AC6)", async () => {
    await byAdmin(w, toMember);
    const result = await declineTransfer(w.deps, w.lastToken(), "member-1");
    expect("data" in result).toBe(true);
    expect(w.users.get("admin-1")!.role?.type).toBe("ngo-admin");
    expect([...w.transfers.values()][0].transferStatus).toBe("declined");
    expect(w.mailer.declined).toHaveBeenCalledWith(
      expect.objectContaining({ to: "admin-1@example.ro" }),
    );
  });

  it("FDSC transfer declined tells the admin and the FDSC initiator (D6)", async () => {
    await byFdsc(w, toMember);
    await declineTransfer(w.deps, w.lastToken(), "member-1");
    const recipients = w.mailer.declined.mock.calls.map((c: any) => c[0].to);
    expect(recipients.sort()).toEqual(["admin-1@example.ro", "fdsc-1@example.ro"]);
  });

  it("the new account declines with the token alone and its account goes (D2)", async () => {
    await byAdmin(w, toNewEmail);
    expect("data" in (await declineNewAccount(w.deps, w.lastToken()))).toBe(true);
    expect([...w.users.values()].some((u) => u.email === "nora@example.ro")).toBe(false);
  });

  it("decline-new refuses an existing account", async () => {
    await byAdmin(w, toMember);
    expect(await declineNewAccount(w.deps, w.lastToken())).toEqual({
      error: TRANSFER_MESSAGES.ACCOUNT_ALREADY_ACTIVE,
    });
  });

  it("a declined link can no longer be accepted", async () => {
    await byAdmin(w, toMember);
    const token = w.lastToken();
    await declineTransfer(w.deps, token, "member-1");
    expect(await acceptTransfer(w.deps, token, "member-1")).toEqual({
      error: TRANSFER_MESSAGES.INVALID_LINK,
    });
  });

  it("an unknown token previews as invalid", async () => {
    expect(await previewTransfer(w.deps, "nope")).toEqual({ valid: false, reason: "invalid" });
  });
});

describe("findIncomingTransfer", () => {
  let w: World;
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    w = world();
  });

  it("shows the recipient their pending proposal with the email's link", async () => {
    await byAdmin(w, toMember);
    const incoming = await findIncomingTransfer(w.deps, "member-1");
    expect(incoming).toMatchObject({
      ongName: "Asociația Test",
      initiatedBy: "ngo-admin",
      initiatorName: "Ana Admin",
      path: `/transfer-admin?token=${encodeURIComponent(w.lastToken())}`,
    });
  });

  it("names no person when FDSC proposed", async () => {
    await byFdsc(w, toMember);
    const incoming = await findIncomingTransfer(w.deps, "member-1");
    expect(incoming).toMatchObject({ initiatedBy: "fdsc", initiatorName: null });
  });

  it("is null for anyone else", async () => {
    await byAdmin(w, toMember);
    expect(await findIncomingTransfer(w.deps, "admin-1")).toBeNull();
  });

  it("is null once the proposal is cancelled", async () => {
    await byAdmin(w, toMember);
    const transfer = (await findPendingForOng(w.deps, "ong-1"))!;
    await cancelTransfer(w.deps, transfer, "admin-1", false);
    expect(await findIncomingTransfer(w.deps, "member-1")).toBeNull();
  });

  it("is null once the proposal has expired, and marks it expired", async () => {
    await byAdmin(w, toMember);
    w.clock.now = new Date("2026-10-02T10:00:00.000Z");
    expect(await findIncomingTransfer(w.deps, "member-1")).toBeNull();
    expect([...w.transfers.values()][0].transferStatus).toBe("expired");
  });
});
