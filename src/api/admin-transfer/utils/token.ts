/**
 * The link token of an admin transfer.
 *
 * Lookups go through a SHA-256 hash, so the database never holds a usable
 * token. "Retrimite" has to send the very same link (US-4 A1), which a hash
 * alone cannot rebuild — hence the AES-256-GCM copy next to it. Its key is
 * derived from the email-link secret, so no new environment variable exists
 * for it and rotating `JWT_SECRET` invalidates both.
 */
import crypto from "crypto";
import { getEmailLinkSecret } from "../../auth/utils/auth";

export const TRANSFER_TTL_DAYS = 7;
export const TRANSFER_PATH = "/transfer-admin";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      getEmailLinkSecret(),
      Buffer.alloc(0),
      "admin-transfer-token",
      32,
    ),
  );
}

export function hashTransferToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function encrypt(raw: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function decryptTransferToken(ciphertext: string): string {
  const bytes = Buffer.from(ciphertext, "base64url");
  const iv = bytes.subarray(0, IV_BYTES);
  const tag = bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = bytes.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function generateTransferToken(): {
  raw: string;
  hash: string;
  ciphertext: string;
} {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashTransferToken(raw), ciphertext: encrypt(raw) };
}

/** The link without the origin, for a page of the app itself. */
export function buildTransferPath(raw: string): string {
  return `${TRANSFER_PATH}?token=${encodeURIComponent(raw)}`;
}

export function buildTransferLink(raw: string): string {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}${buildTransferPath(raw)}`;
}

export function computeExpiresAt(now: Date): Date {
  return new Date(now.getTime() + TRANSFER_TTL_DAYS * 24 * 60 * 60 * 1000);
}
