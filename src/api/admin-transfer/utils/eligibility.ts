/**
 * Who may receive the admin role of an ONG ("Eligibilitatea destinatarului").
 *
 * Only two answers are yes: an address with no account (a pending account is
 * created for it) and an active member of the initiating ONG who belongs to no
 * other organization. Everything else is refused. Run both when the transfer
 * is created and again when it is accepted (US-3 BR4).
 */
import { TRANSFER_MESSAGES } from "./messages";

export type Candidate = {
  documentId: string;
  email: string;
  accountStatus: "pending" | "active" | "deleted";
  role?: { type?: string } | null;
  ong?: { documentId: string }[] | null;
} | null;

export type Eligibility =
  | { kind: "new-account" }
  | { kind: "member"; userDocumentId: string }
  | { kind: "refused"; message: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * `initiatorDocumentId` is null for a transfer FDSC starts: the FDSC Admin can
 * never be the recipient anyway (their role is refused below).
 */
export function classifyRecipient(
  candidate: Candidate,
  ongDocumentId: string,
  initiatorDocumentId: string | null,
): Eligibility {
  if (!candidate) {
    return { kind: "new-account" };
  }
  if (initiatorDocumentId && candidate.documentId === initiatorDocumentId) {
    return { kind: "refused", message: TRANSFER_MESSAGES.SELF };
  }
  const ongs = (candidate.ong ?? []).filter(Boolean);
  const onlyThisOng =
    ongs.length === 1 && ongs[0].documentId === ongDocumentId;
  if (candidate.role?.type !== "ngo-member" || !onlyThisOng) {
    return { kind: "refused", message: TRANSFER_MESSAGES.NOT_ELIGIBLE };
  }
  if (candidate.accountStatus === "pending") {
    return { kind: "refused", message: TRANSFER_MESSAGES.PENDING_MEMBER };
  }
  if (candidate.accountStatus !== "active") {
    return { kind: "refused", message: TRANSFER_MESSAGES.NOT_ELIGIBLE };
  }
  return { kind: "member", userDocumentId: candidate.documentId };
}
