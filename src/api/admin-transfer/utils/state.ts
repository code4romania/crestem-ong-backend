/**
 * Lifecycle of an admin transfer: `pending` until it becomes `accepted`,
 * `declined`, `cancelled` or `expired` — all four final.
 *
 * Expiry is lazy (US-4 A3): nothing flips a transfer at the deadline; the
 * first read after it treats the transfer as expired and records that.
 */
export type TransferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export type TransferInitiatedBy = "ngo-admin" | "fdsc";

type TransferLike = {
  transferStatus: string;
  expiresAt: string | Date;
  initiatedBy?: string;
  initiator?: { documentId?: string } | null;
};

export function isExpired(transfer: TransferLike, now: Date): boolean {
  return (
    transfer.transferStatus === "pending" &&
    new Date(transfer.expiresAt).getTime() <= now.getTime()
  );
}

export function isActionable(transfer: TransferLike, now: Date): boolean {
  return transfer.transferStatus === "pending" && !isExpired(transfer, now);
}

/**
 * Anulează / Retrimite for the ONG admin: only on the transfer they started
 * themselves. A transfer FDSC started is visible to them, never theirs to
 * change (US-5 AC1); US-4 BR3 leaves the rest to the FDSC Admin.
 */
export function canNgoAdminManage(
  transfer: TransferLike,
  userDocumentId: string,
): boolean {
  return (
    transfer.initiatedBy === "ngo-admin" &&
    transfer.initiator?.documentId === userDocumentId
  );
}
