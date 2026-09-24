/**
 * Transfer rol Admin ONG — the flows of US-1 … US-5, written against a small
 * repository and mailer so the rules can be tested without Strapi. The Strapi
 * implementations live in `./repository.ts` and the email service.
 *
 * Invariants kept here:
 * - the role moves only on accept, inside one transaction (US-3 BR1, AC4);
 * - a transfer leaves `pending` exactly once — `resolveTransfer` is a
 *   compare-and-set, so a second click or a race loses cleanly (US-3 AC5);
 * - expiry is lazy: every read goes through `expireIfDue` first (US-4 A3);
 * - a pending account created by the invite never outlives it (US-2 A7).
 */
import { classifyRecipient, normalizeEmail } from "../utils/eligibility";
import { TRANSFER_MESSAGES } from "../utils/messages";
import { isExpired, type TransferInitiatedBy, type TransferStatus } from "../utils/state";
import {
  buildTransferLink,
  buildTransferPath,
  computeExpiresAt,
  decryptTransferToken,
  generateTransferToken,
  hashTransferToken,
} from "../utils/token";

export type UserRecord = {
  id: number;
  documentId: string;
  nume: string;
  email: string;
  accountStatus: "pending" | "active" | "deleted";
  role?: { type?: string } | null;
  ong?: { documentId: string }[] | null;
};

export type OngRecord = {
  documentId: string;
  name: string;
  ngoStatus: string;
};

export type TransferRecord = {
  id: number;
  documentId: string;
  transferStatus: TransferStatus;
  initiatedBy: TransferInitiatedBy;
  expiresAt: string;
  ong: OngRecord | null;
  initiator: UserRecord | null;
  previousAdmin: UserRecord | null;
  recipient: UserRecord | null;
  recipientEmail: string;
  recipientName: string | null;
  createdPendingAccount: boolean;
  tokenCiphertext: string;
};

export type NewTransfer = {
  ongDocumentId: string;
  initiatedBy: TransferInitiatedBy;
  initiatorDocumentId: string;
  previousAdminDocumentId: string | null;
  recipientDocumentId: string;
  recipientEmail: string;
  recipientName: string;
  createdPendingAccount: boolean;
  tokenHash: string;
  tokenCiphertext: string;
  expiresAt: Date;
};

export interface TransferRepo {
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  findTransferByHash(tokenHash: string): Promise<TransferRecord | null>;
  findPendingForOng(ongDocumentId: string): Promise<TransferRecord[]>;
  findPendingForEmail(email: string): Promise<TransferRecord[]>;
  findPendingForRecipient(userDocumentId: string): Promise<TransferRecord[]>;
  createTransfer(data: NewTransfer): Promise<TransferRecord>;
  /**
   * Moves the transfer from `pending` to `status` only if it is still pending.
   * Returns false when another request resolved it first.
   */
  resolveTransfer(
    transfer: TransferRecord,
    status: Exclude<TransferStatus, "pending">,
    resolvedByDocumentId: string | null,
    at: Date,
  ): Promise<boolean>;
  findOng(ongDocumentId: string): Promise<OngRecord | null>;
  findUser(userDocumentId: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findOngAdmin(ongDocumentId: string): Promise<UserRecord | null>;
  createPendingAccount(data: { nume: string; email: string }): Promise<UserRecord>;
  activateAccount(user: UserRecord, password: string): Promise<void>;
  deleteUser(user: UserRecord): Promise<void>;
  /** Role `ngo-admin`, the ONG as sole membership, member-role row removed. */
  makeAdmin(user: UserRecord, ongDocumentId: string): Promise<void>;
  /** Membership and member-role row removed; `individual` when none is left. */
  removeFromOng(user: UserRecord, ongDocumentId: string): Promise<void>;
}

export type ProposalEmail = {
  to: string;
  nume: string;
  ongName: string;
  initiatorName: string;
  fromFdsc: boolean;
  isNewAccount: boolean;
  link: string;
  expiresAt: string;
};

export type TransferEmail = {
  to: string;
  nume: string;
  ongName: string;
  /** The other party, named in the body (recipient or new admin). */
  otherName?: string;
};

export interface TransferMailer {
  proposal(args: ProposalEmail): Promise<void>;
  fdscNotice(args: TransferEmail): Promise<void>;
  accepted(args: TransferEmail): Promise<void>;
  replaced(args: TransferEmail): Promise<void>;
  declined(args: TransferEmail): Promise<void>;
  cancelled(args: TransferEmail): Promise<void>;
  cancelledByFdsc(args: TransferEmail): Promise<void>;
  autoCancelled(args: TransferEmail): Promise<void>;
}

export type Deps = {
  repo: TransferRepo;
  mailer: TransferMailer;
  now: () => Date;
  log?: (message: string, error: unknown) => void;
};

type Failure = { error: string };
type Ok<T> = { data: T };
export type Result<T> = Ok<T> | Failure;

const fail = (error: string): Failure => ({ error });

export type TransferTarget =
  | { mode: "member"; memberDocumentId: string }
  | { mode: "email"; nume: string; email: string };

async function send(deps: Deps, label: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error) {
    (deps.log ?? console.error)(`admin transfer email "${label}" failed`, error);
    return false;
  }
}

const recipientLabel = (transfer: TransferRecord) =>
  transfer.recipientName || transfer.recipientEmail;

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Deletes the account the invite created (US-2 A7, US-4 step 3, D2) — only
 * while it was never activated and has no membership of its own, so a
 * person invited elsewhere in the meantime keeps that invite.
 */
async function cleanupPendingAccount(deps: Deps, transfer: TransferRecord) {
  if (!transfer.createdPendingAccount || !transfer.recipient) return;
  const recipient = await deps.repo.findUser(transfer.recipient.documentId);
  if (!recipient || recipient.accountStatus !== "pending") return;
  if ((recipient.ong ?? []).filter(Boolean).length > 0) return;
  await deps.repo.deleteUser(recipient);
}

/** Lazy expiry (US-4 A3). Returns the transfer as it stands after the check. */
export async function expireIfDue(
  deps: Deps,
  transfer: TransferRecord,
): Promise<TransferRecord> {
  const now = deps.now();
  if (!isExpired(transfer, now)) return transfer;
  const moved = await deps.repo.resolveTransfer(transfer, "expired", null, now);
  if (moved) {
    await cleanupPendingAccount(deps, transfer);
  }
  return { ...transfer, transferStatus: "expired" };
}

export async function findPendingForOng(
  deps: Deps,
  ongDocumentId: string,
): Promise<TransferRecord | null> {
  const rows = await deps.repo.findPendingForOng(ongDocumentId);
  let pending: TransferRecord | null = null;
  for (const row of rows) {
    const current = await expireIfDue(deps, row);
    if (current.transferStatus === "pending" && !pending) pending = current;
  }
  return pending;
}

export type IncomingTransfer = {
  documentId: string;
  ongName: string;
  initiatedBy: TransferInitiatedBy;
  initiatorName: string | null;
  expiresAt: string;
  /** The email's link without the origin, so the recipient can open it in-app. */
  path: string;
};

/**
 * The proposal waiting for the signed-in user (D11, beyond the document). An
 * eligible recipient belongs to one ONG, which has at most one pending
 * transfer, so there is never more than one.
 */
export async function findIncomingTransfer(
  deps: Deps,
  userDocumentId: string,
): Promise<IncomingTransfer | null> {
  const rows = await deps.repo.findPendingForRecipient(userDocumentId);
  for (const row of rows) {
    const current = await expireIfDue(deps, row);
    if (current.transferStatus !== "pending" || !current.ong) continue;
    return {
      documentId: current.documentId,
      ongName: current.ong.name,
      initiatedBy: current.initiatedBy,
      initiatorName: current.initiatedBy === "fdsc" ? null : current.initiator?.nume ?? null,
      expiresAt: current.expiresAt,
      path: buildTransferPath(decryptTransferToken(current.tokenCiphertext)),
    };
  }
  return null;
}

async function resolveTarget(
  deps: Deps,
  ong: OngRecord,
  target: TransferTarget,
  initiatorForEligibility: string | null,
): Promise<
  Result<
    | { kind: "member"; user: UserRecord }
    | { kind: "new-account"; nume: string; email: string }
  >
> {
  if (target.mode === "member") {
    const user = await deps.repo.findUser(target.memberDocumentId);
    const inOng = (user?.ong ?? []).some(
      (entry) => entry?.documentId === ong.documentId,
    );
    if (!user || !inOng) return fail(TRANSFER_MESSAGES.MEMBER_NOT_FOUND);
    const verdict = classifyRecipient(user, ong.documentId, initiatorForEligibility);
    if (verdict.kind === "refused") return fail(verdict.message);
    return { data: { kind: "member", user } };
  }

  const email = normalizeEmail(target.email);
  // An address still held by an expired invite's pending account must count
  // as "no account", so the lazy cleanup runs before the lookup.
  for (const row of await deps.repo.findPendingForEmail(email)) {
    await expireIfDue(deps, row);
  }
  const existing = await deps.repo.findUserByEmail(email);
  const verdict = classifyRecipient(existing, ong.documentId, initiatorForEligibility);
  if (verdict.kind === "refused") return fail(verdict.message);
  if (verdict.kind === "member") {
    // US-2 A4: an active member's address continues as US-1.
    return { data: { kind: "member", user: existing as UserRecord } };
  }
  return { data: { kind: "new-account", nume: target.nume.trim(), email } };
}

export type CreateInput = {
  ong: OngRecord;
  initiator: { documentId: string; nume: string };
  initiatedBy: TransferInitiatedBy;
  target: TransferTarget;
};

/**
 * US-1 / US-2 / US-5. The ONG admin's password is checked by the caller before
 * this runs (US-1 A1): a wrong password must not reach any of these reads.
 */
export async function createTransfer(
  deps: Deps,
  input: CreateInput,
): Promise<Result<{ transfer: TransferRecord; emailSent: boolean }>> {
  const { ong, initiator, initiatedBy } = input;
  if (ong.ngoStatus !== "active") return fail(TRANSFER_MESSAGES.ONG_NOT_ACTIVE);

  if (await findPendingForOng(deps, ong.documentId)) {
    return fail(TRANSFER_MESSAGES.ALREADY_PENDING);
  }

  const initiatorForEligibility =
    initiatedBy === "ngo-admin" ? initiator.documentId : null;
  const resolved = await resolveTarget(deps, ong, input.target, initiatorForEligibility);
  if ("error" in resolved) return resolved;
  const target = resolved.data;

  const previousAdmin = await deps.repo.findOngAdmin(ong.documentId);
  const token = generateTransferToken();
  const expiresAt = computeExpiresAt(deps.now());

  const transfer = await deps.repo.transaction(async () => {
    const recipient =
      target.kind === "member"
        ? target.user
        : await deps.repo.createPendingAccount({ nume: target.nume, email: target.email });
    return deps.repo.createTransfer({
      ongDocumentId: ong.documentId,
      initiatedBy,
      initiatorDocumentId: initiator.documentId,
      previousAdminDocumentId: previousAdmin?.documentId ?? null,
      recipientDocumentId: recipient.documentId,
      recipientEmail: recipient.email,
      recipientName: recipient.nume,
      createdPendingAccount: target.kind === "new-account",
      tokenHash: token.hash,
      tokenCiphertext: token.ciphertext,
      expiresAt,
    });
  });

  const emailSent = await sendProposal(deps, transfer, token.raw);

  if (initiatedBy === "fdsc" && previousAdmin) {
    await send(deps, "fdscNotice", () =>
      deps.mailer.fdscNotice({
        to: previousAdmin.email,
        nume: previousAdmin.nume,
        ongName: ong.name,
        otherName: recipientLabel(transfer),
      }),
    );
  }

  return { data: { transfer, emailSent } };
}

function sendProposal(deps: Deps, transfer: TransferRecord, rawToken: string) {
  return send(deps, "proposal", () =>
    deps.mailer.proposal({
      to: transfer.recipientEmail,
      nume: transfer.recipientName || transfer.recipientEmail,
      ongName: transfer.ong?.name ?? "",
      initiatorName: transfer.initiator?.nume ?? "",
      fromFdsc: transfer.initiatedBy === "fdsc",
      isNewAccount: transfer.createdPendingAccount,
      link: buildTransferLink(rawToken),
      expiresAt: transfer.expiresAt,
    }),
  );
}

/** US-4 A1: the same link again; `expiresAt` is left alone (BR2). */
export async function resendTransfer(
  deps: Deps,
  transfer: TransferRecord,
): Promise<Result<{ emailSent: boolean }>> {
  const current = await expireIfDue(deps, transfer);
  if (current.transferStatus !== "pending") return fail(TRANSFER_MESSAGES.NO_PENDING);
  const raw = decryptTransferToken(current.tokenCiphertext);
  return { data: { emailSent: await sendProposal(deps, current, raw) } };
}

/**
 * US-4. `byFdsc` marks an FDSC Admin cancelling; when the transfer was the ONG
 * admin's own, they are told why it disappeared (D6).
 */
export async function cancelTransfer(
  deps: Deps,
  transfer: TransferRecord,
  actorDocumentId: string,
  byFdsc: boolean,
): Promise<Result<{ documentId: string }>> {
  const current = await expireIfDue(deps, transfer);
  if (current.transferStatus !== "pending") return fail(TRANSFER_MESSAGES.NO_PENDING);
  const moved = await deps.repo.resolveTransfer(current, "cancelled", actorDocumentId, deps.now());
  if (!moved) return fail(TRANSFER_MESSAGES.NO_PENDING);

  await cleanupPendingAccount(deps, current);

  const ongName = current.ong?.name ?? "";
  if (current.recipient?.accountStatus === "active") {
    await send(deps, "cancelled", () =>
      deps.mailer.cancelled({
        to: current.recipientEmail,
        nume: recipientLabel(current),
        ongName,
      }),
    );
  }
  if (byFdsc && current.initiatedBy === "ngo-admin" && current.initiator) {
    const initiator = current.initiator;
    await send(deps, "cancelledByFdsc", () =>
      deps.mailer.cancelledByFdsc({
        to: initiator.email,
        nume: initiator.nume,
        ongName,
        otherName: recipientLabel(current),
      }),
    );
  }
  return { data: { documentId: current.documentId } };
}

/** Cancels silently when the ONG is deleted (D5); runs inside that transaction. */
export async function cancelForOngDeletion(deps: Deps, ongDocumentId: string) {
  for (const row of await deps.repo.findPendingForOng(ongDocumentId)) {
    const moved = await deps.repo.resolveTransfer(row, "cancelled", null, deps.now());
    if (moved) await cleanupPendingAccount(deps, row);
  }
}

export type TransferPreview =
  | {
      valid: true;
      documentId: string;
      ongName: string;
      initiatedBy: TransferInitiatedBy;
      initiatorName: string | null;
      expiresAt: string;
      recipientType: "existing" | "new";
      recipientDocumentId: string;
      recipientName: string | null;
      recipientEmailMasked: string;
    }
  | { valid: false; reason: "invalid" | "expired" | "resolved" };

async function loadByToken(
  deps: Deps,
  rawToken: string,
): Promise<TransferRecord | null> {
  if (!rawToken) return null;
  const transfer = await deps.repo.findTransferByHash(hashTransferToken(rawToken));
  return transfer ? expireIfDue(deps, transfer) : null;
}

/** What the page behind the email link shows (US-3 step 3, A2). */
export async function previewTransfer(
  deps: Deps,
  rawToken: string,
): Promise<TransferPreview> {
  const transfer = await loadByToken(deps, rawToken);
  if (!transfer || !transfer.recipient || !transfer.ong) {
    return { valid: false, reason: "invalid" };
  }
  if (transfer.transferStatus === "expired") return { valid: false, reason: "expired" };
  if (transfer.transferStatus !== "pending") return { valid: false, reason: "resolved" };
  return {
    valid: true,
    documentId: transfer.documentId,
    ongName: transfer.ong.name,
    initiatedBy: transfer.initiatedBy,
    initiatorName: transfer.initiatedBy === "fdsc" ? null : transfer.initiator?.nume ?? null,
    expiresAt: transfer.expiresAt,
    recipientType: transfer.recipient.accountStatus === "pending" ? "new" : "existing",
    recipientDocumentId: transfer.recipient.documentId,
    recipientName: transfer.recipientName,
    recipientEmailMasked: maskEmail(transfer.recipientEmail),
  };
}

/** Everyone told about an outcome the initiator did not cause (D6). */
async function initiatorSideRecipients(
  deps: Deps,
  transfer: TransferRecord,
): Promise<UserRecord[]> {
  const people: UserRecord[] = [];
  const currentAdmin = transfer.ong
    ? await deps.repo.findOngAdmin(transfer.ong.documentId)
    : null;
  if (currentAdmin) people.push(currentAdmin);
  if (
    transfer.initiatedBy === "fdsc" &&
    transfer.initiator &&
    !people.some((p) => p.documentId === transfer.initiator!.documentId)
  ) {
    people.push(transfer.initiator);
  }
  return people;
}

async function cancelAndNotify(deps: Deps, transfer: TransferRecord, message: string) {
  const moved = await deps.repo.resolveTransfer(transfer, "cancelled", null, deps.now());
  if (!moved) return fail(TRANSFER_MESSAGES.INVALID_LINK);
  await cleanupPendingAccount(deps, transfer);
  for (const person of await initiatorSideRecipients(deps, transfer)) {
    await send(deps, "autoCancelled", () =>
      deps.mailer.autoCancelled({
        to: person.email,
        nume: person.nume,
        ongName: transfer.ong?.name ?? "",
        otherName: recipientLabel(transfer),
      }),
    );
  }
  return fail(message);
}

/**
 * The checks shared by both accept paths (US-3 preconditions, A2, A4, A5, BR4).
 * A refusal that ends the transfer is committed on its own, so it sticks.
 */
async function checkAcceptable(
  deps: Deps,
  transfer: TransferRecord | null,
): Promise<Result<{ transfer: TransferRecord; ong: OngRecord; recipient: UserRecord }>> {
  if (!transfer || transfer.transferStatus !== "pending" || !transfer.ong) {
    return fail(TRANSFER_MESSAGES.INVALID_LINK);
  }
  const ong = await deps.repo.findOng(transfer.ong.documentId);
  if (!ong || ong.ngoStatus === "deleted") {
    return cancelAndNotify(deps, transfer, TRANSFER_MESSAGES.ONG_DELETED);
  }
  if (ong.ngoStatus !== "active") return fail(TRANSFER_MESSAGES.ONG_NOT_ACTIVE);

  const recipient = transfer.recipient
    ? await deps.repo.findUser(transfer.recipient.documentId)
    : null;
  if (!recipient) return fail(TRANSFER_MESSAGES.INVALID_LINK);
  return { data: { transfer, ong, recipient } };
}

async function swapAdmin(
  deps: Deps,
  transfer: TransferRecord,
  ong: OngRecord,
  recipient: UserRecord,
  password?: string,
): Promise<Result<{ previousAdmin: UserRecord | null }>> {
  const now = deps.now();
  const outcome = await deps.repo.transaction(async () => {
    // Claim first: a concurrent accept or decline finds nothing left to move.
    const moved = await deps.repo.resolveTransfer(transfer, "accepted", recipient.documentId, now);
    if (!moved) return null;
    if (password !== undefined) {
      await deps.repo.activateAccount(recipient, password);
    }
    const previousAdmin = await deps.repo.findOngAdmin(ong.documentId);
    await deps.repo.makeAdmin(recipient, ong.documentId);
    if (previousAdmin && previousAdmin.documentId !== recipient.documentId) {
      await deps.repo.removeFromOng(previousAdmin, ong.documentId);
      return { previousAdmin };
    }
    return { previousAdmin: null };
  });
  if (!outcome) return fail(TRANSFER_MESSAGES.INVALID_LINK);

  await send(deps, "accepted", () =>
    deps.mailer.accepted({ to: recipient.email, nume: recipient.nume, ongName: ong.name }),
  );
  const previousAdmin = outcome.previousAdmin;
  if (previousAdmin) {
    await send(deps, "replaced", () =>
      deps.mailer.replaced({
        to: previousAdmin.email,
        nume: previousAdmin.nume,
        ongName: ong.name,
        otherName: recipient.nume,
      }),
    );
  }
  return { data: outcome };
}

/** US-3, existing account: the signed-in recipient accepts. */
export async function acceptTransfer(
  deps: Deps,
  rawToken: string,
  actorDocumentId: string,
): Promise<Result<{ recipientId: number }>> {
  const checked = await checkAcceptable(deps, await loadByToken(deps, rawToken));
  if ("error" in checked) return checked;
  const { transfer, ong, recipient } = checked.data;

  if (recipient.documentId !== actorDocumentId) return fail(TRANSFER_MESSAGES.WRONG_ACCOUNT);
  if (recipient.accountStatus !== "active") return fail(TRANSFER_MESSAGES.ACCOUNT_NOT_ACTIVE);

  const initiatorForEligibility =
    transfer.initiatedBy === "ngo-admin" ? transfer.initiator?.documentId ?? null : null;
  const verdict = classifyRecipient(recipient, ong.documentId, initiatorForEligibility);
  if (verdict.kind !== "member") {
    const stillInOng = (recipient.ong ?? []).some((e) => e?.documentId === ong.documentId);
    return cancelAndNotify(
      deps,
      transfer,
      stillInOng ? TRANSFER_MESSAGES.NOT_ELIGIBLE : TRANSFER_MESSAGES.RECIPIENT_REMOVED,
    );
  }

  const swapped = await swapAdmin(deps, transfer, ong, recipient);
  if ("error" in swapped) return swapped;
  return { data: { recipientId: recipient.id } };
}

function isUntouchedInvite(recipient: UserRecord) {
  return (
    recipient.accountStatus === "pending" &&
    (recipient.ong ?? []).filter(Boolean).length === 0
  );
}

/** US-3 step 8: the invited address sets its password and becomes admin in one go. */
export async function acceptNewAccount(
  deps: Deps,
  rawToken: string,
  password: string,
): Promise<Result<{ recipientId: number }>> {
  const checked = await checkAcceptable(deps, await loadByToken(deps, rawToken));
  if ("error" in checked) return checked;
  const { transfer, ong, recipient } = checked.data;

  if (recipient.accountStatus !== "pending") {
    return fail(TRANSFER_MESSAGES.ACCOUNT_ALREADY_ACTIVE);
  }
  if (!isUntouchedInvite(recipient)) {
    return cancelAndNotify(deps, transfer, TRANSFER_MESSAGES.NOT_ELIGIBLE);
  }

  const swapped = await swapAdmin(deps, transfer, ong, recipient, password);
  if ("error" in swapped) return swapped;
  return { data: { recipientId: recipient.id } };
}

async function declineCommon(deps: Deps, transfer: TransferRecord, actorDocumentId: string | null) {
  const moved = await deps.repo.resolveTransfer(transfer, "declined", actorDocumentId, deps.now());
  if (!moved) return fail(TRANSFER_MESSAGES.INVALID_LINK);
  await cleanupPendingAccount(deps, transfer);
  for (const person of await initiatorSideRecipients(deps, transfer)) {
    await send(deps, "declined", () =>
      deps.mailer.declined({
        to: person.email,
        nume: person.nume,
        ongName: transfer.ong?.name ?? "",
        otherName: recipientLabel(transfer),
      }),
    );
  }
  return { data: { documentId: transfer.documentId } };
}

/** US-3 A1, existing account: only the signed-in recipient may decline. */
export async function declineTransfer(
  deps: Deps,
  rawToken: string,
  actorDocumentId: string,
): Promise<Result<{ documentId: string }>> {
  const transfer = await loadByToken(deps, rawToken);
  if (!transfer || transfer.transferStatus !== "pending" || !transfer.recipient) {
    return fail(TRANSFER_MESSAGES.INVALID_LINK);
  }
  if (transfer.recipient.documentId !== actorDocumentId) {
    return fail(TRANSFER_MESSAGES.WRONG_ACCOUNT);
  }
  return declineCommon(deps, transfer, actorDocumentId);
}

/** D2: the invited address declines with the token alone; its account goes. */
export async function declineNewAccount(
  deps: Deps,
  rawToken: string,
): Promise<Result<{ documentId: string }>> {
  const transfer = await loadByToken(deps, rawToken);
  if (!transfer || transfer.transferStatus !== "pending" || !transfer.recipient) {
    return fail(TRANSFER_MESSAGES.INVALID_LINK);
  }
  const recipient = await deps.repo.findUser(transfer.recipient.documentId);
  if (!recipient || recipient.accountStatus !== "pending") {
    return fail(TRANSFER_MESSAGES.ACCOUNT_ALREADY_ACTIVE);
  }
  return declineCommon(deps, transfer, null);
}

/** The shape the ONG admin's and the FDSC Admin's screens read. */
export function toTransferView(transfer: TransferRecord, canManage: boolean) {
  return {
    documentId: transfer.documentId,
    initiatedBy: transfer.initiatedBy,
    initiatorName: transfer.initiator?.nume ?? null,
    recipientName: transfer.recipientName,
    recipientEmail: transfer.recipientEmail,
    recipientIsNewAccount: transfer.createdPendingAccount,
    expiresAt: transfer.expiresAt,
    canManage,
  };
}
