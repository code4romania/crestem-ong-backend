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

export const MENTOR_ACTIVATION_PATH = "/mentor/activare";
export const MEMBER_ACTIVATION_PATH = "/membru/activare";

export const buildActivationLink = (token: string, path: string) => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}${path}?token=${encodeURIComponent(token)}`;
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
