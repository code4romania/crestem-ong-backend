import type { Core } from "@strapi/strapi";
import crypto from "crypto";

const UID = "api::refresh-token.refresh-token" as const;

const INVALID_REFRESH = "Sesiune invalidă sau expirată. Autentifică-te din nou";

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const parseDuration = (value: string, fallbackMs: number) => {
  const match = /^(\d+)([smhd])$/.exec((value || "").trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * DURATION_UNITS[match[2]];
};

const hashToken = (raw: string) =>
  crypto.createHash("sha256").update(raw).digest("hex");

const generateRawToken = () => crypto.randomBytes(48).toString("hex");

const refreshTtlMs = () =>
  parseDuration(process.env.REFRESH_TOKEN_TTL, 30 * DURATION_UNITS.d);

export type RotateResult = {
  userId: number;
  refreshToken: string;
};

export interface RefreshTokenService {
  issue(
    userId: number,
    userAgent?: string,
    familyId?: string,
  ): Promise<string>;
  rotate(rawToken: string, userAgent?: string): Promise<RotateResult>;
  revoke(rawToken: string): Promise<void>;
  revokeAllForUser(userId: number): Promise<void>;
  cleanup(): Promise<number>;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async issue(userId: number, userAgent?: string, familyId?: string) {
    const raw = generateRawToken();

    await strapi.db.query(UID).create({
      data: {
        tokenHash: hashToken(raw),
        familyId: familyId || crypto.randomUUID(),
        user: userId,
        expiresAt: new Date(Date.now() + refreshTtlMs()),
        userAgent: userAgent ? userAgent.slice(0, 255) : null,
      },
    });

    return raw;
  },

  async rotate(rawToken: string, userAgent?: string): Promise<RotateResult> {
    const record = await strapi.db.query(UID).findOne({
      where: { tokenHash: hashToken(rawToken) },
      populate: ["user"],
    });

    if (!record) {
      throw new Error(INVALID_REFRESH);
    }

    if (record.revokedAt) {
      await strapi.db.query(UID).updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      strapi.log.warn(
        `[refresh-token] Reuse detected for family ${record.familyId}; family revoked.`,
      );
      throw new Error(INVALID_REFRESH);
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new Error(INVALID_REFRESH);
    }

    if (!record.user || record.user.status !== "active") {
      throw new Error(INVALID_REFRESH);
    }

    await strapi.db.query(UID).update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const raw = generateRawToken();

    await strapi.db.query(UID).create({
      data: {
        tokenHash: hashToken(raw),
        familyId: record.familyId,
        user: record.user.id,
        expiresAt: new Date(Date.now() + refreshTtlMs()),
        userAgent: userAgent ? userAgent.slice(0, 255) : record.userAgent,
      },
    });

    return { userId: record.user.id, refreshToken: raw };
  },

  async revoke(rawToken: string) {
    await strapi.db.query(UID).updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllForUser(userId: number) {
    const rows = await strapi.db.query(UID).findMany({
      where: { user: userId, revokedAt: null },
      select: ["id"],
    });

    if (!rows.length) return;

    await strapi.db.query(UID).updateMany({
      where: { id: { $in: rows.map((row: { id: number }) => row.id) } },
      data: { revokedAt: new Date() },
    });
  },

  async cleanup() {
    const staleRevokedBefore = new Date(Date.now() - refreshTtlMs());

    const { count } = await strapi.db.query(UID).deleteMany({
      where: {
        $or: [
          { expiresAt: { $lt: new Date() } },
          { revokedAt: { $lt: staleRevokedBefore } },
        ],
      },
    });

    const orphans = await strapi.db.query(UID).findMany({
      where: { user: null },
      select: ["id"],
    });

    if (!orphans.length) return count;

    const { count: orphanCount } = await strapi.db.query(UID).deleteMany({
      where: { id: { $in: orphans.map((row: { id: number }) => row.id) } },
    });

    return count + orphanCount;
  },
});
