import jwt from "jsonwebtoken";
import crypto from "crypto";

export const ACTIVATION_PURPOSE = "mentor-activation";

export type AuthTokenPayload = {
  id: number;
  purpose: string;
};

export type ActivationTokenPayload = AuthTokenPayload;

export const getEmailLinkSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET nu este configurat.");
  }
  return crypto
    .createHmac("sha256", secret)
    .update("email-link-token")
    .digest("hex");
};

export const signActivationToken = (userId: number) =>
  jwt.sign({ id: userId, purpose: ACTIVATION_PURPOSE }, getEmailLinkSecret(), {
    expiresIn: process.env.ACTIVATION_TTL,
  } as jwt.SignOptions);

/**
 * Shared by every invite flow (mentor, member, staff) — the frontend page
 * hosting `ActivateAccountForm` is role-agnostic, so there is a single path.
 */
export const ACTIVATION_PATH = "/membru/activare";

export const STAFF_ROLE_LABELS: Record<"super-admin" | "editor-fdsc", string> = {
  "super-admin": "Admin FDSC",
  "editor-fdsc": "Editor FDSC",
};

export const buildActivationLink = (token: string, path: string) => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}${path}?token=${encodeURIComponent(token)}`;
};

export const LOGIN_PATH = "/autentificare";

export const buildLoginLink = () => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}${LOGIN_PATH}`;
};

export const RESET_PURPOSE = "password-reset";

export const signResetToken = (userId: number) =>
  jwt.sign({ id: userId, purpose: RESET_PURPOSE }, getEmailLinkSecret(), {
    expiresIn: process.env.PASSWORD_RESET_TTL || "1h",
  } as jwt.SignOptions);

export const buildResetLink = (token: string) => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}/resetare-parola?token=${encodeURIComponent(token)}`;
};

export const EMAIL_CHANGE_PURPOSE = "email-change";

export type EmailChangeTokenPayload = AuthTokenPayload & { newEmail: string };

export const EMAIL_CHANGE_PATH = "/schimbare-email";

export const signEmailChangeToken = (userId: number, newEmail: string) =>
  jwt.sign(
    { id: userId, purpose: EMAIL_CHANGE_PURPOSE, newEmail },
    getEmailLinkSecret(),
    {
      expiresIn: process.env.EMAIL_CHANGE_TTL || "1h",
    } as jwt.SignOptions,
  );

/**
 * Same purpose and secret as the self-service token, so `/schimbare-email`
 * confirms it unchanged; only the lifetime differs, because the person has to
 * notice an email they did not ask for. Shares `ACTIVATION_TTL` with the
 * invitation link: both are links FDSC sends on someone's behalf.
 */
export const signAdminEmailChangeToken = (userId: number, newEmail: string) =>
  jwt.sign(
    { id: userId, purpose: EMAIL_CHANGE_PURPOSE, newEmail },
    getEmailLinkSecret(),
    {
      expiresIn: process.env.ACTIVATION_TTL || "7d",
    } as jwt.SignOptions,
  );

export const buildEmailChangeLink = (token: string) => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}${EMAIL_CHANGE_PATH}?token=${encodeURIComponent(token)}`;
};
