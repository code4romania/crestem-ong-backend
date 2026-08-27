import type { Core } from "@strapi/strapi";
import crypto from "crypto";

import {
  hashToken,
  generateRawToken,
  refreshTtlMs,
  reuseGraceMs,
} from "../utils/refresh-token";

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

    await strapi.db.query("api::refresh-token.refresh-token").create({
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
    const record = await strapi.db.query("api::refresh-token.refresh-token").findOne({
      where: { tokenHash: hashToken(rawToken) },
      populate: ["user"],
    });

    if (!record) {
      throw new Error("Sesiune invalidă sau expirată. Autentifică-te din nou");
    }

    // A Link prefetch and the click that follows it both carry whatever refresh
    // cookie the browser held before either response came back, so the second
    // call can arrive milliseconds after the token was legitimately rotated.
    // Inside the grace window that is a concurrent refresh, not theft: issue
    // another sibling and leave the successor the first call created alone.
    // A live sibling must still exist — without one the family was already
    // swept, and honouring the token would resurrect a revoked session.
    let concurrentRefresh = false;
    if (record.revokedAt) {
      const revokedAgeMs = Date.now() - new Date(record.revokedAt).getTime();
      const liveSiblings = await strapi.db
        .query("api::refresh-token.refresh-token")
        .count({ where: { familyId: record.familyId, revokedAt: null } });
      concurrentRefresh = revokedAgeMs <= reuseGraceMs() && liveSiblings > 0;
    }

    if (record.revokedAt && !concurrentRefresh) {
      await strapi.db.query("api::refresh-token.refresh-token").updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      strapi.log.warn(
        `[refresh-token] Reuse detected for family ${record.familyId}; family revoked.`,
      );
      throw new Error("Sesiune invalidă sau expirată. Autentifică-te din nou");
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new Error("Sesiune invalidă sau expirată. Autentifică-te din nou");
    }

    if (!record.user || record.user.accountStatus !== "active") {
      throw new Error("Sesiune invalidă sau expirată. Autentifică-te din nou");
    }

    if (concurrentRefresh) {
      strapi.log.info(
        `[refresh-token] Concurrent refresh for family ${record.familyId}; issuing a sibling.`,
      );
    } else {
      await strapi.db.query("api::refresh-token.refresh-token").update({
        where: { id: record.id },
        data: { revokedAt: new Date() },
      });
    }

    const raw = generateRawToken();

    await strapi.db.query("api::refresh-token.refresh-token").create({
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
    await strapi.db.query("api::refresh-token.refresh-token").updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllForUser(userId: number) {
    const rows = await strapi.db.query("api::refresh-token.refresh-token").findMany({
      where: { user: userId, revokedAt: null },
      select: ["id"],
    });

    if (!rows.length) return;

    await strapi.db.query("api::refresh-token.refresh-token").updateMany({
      where: { id: { $in: rows.map((row: { id: number }) => row.id) } },
      data: { revokedAt: new Date() },
    });
  },

  async cleanup() {
    const staleRevokedBefore = new Date(Date.now() - refreshTtlMs());

    const { count } = await strapi.db.query("api::refresh-token.refresh-token").deleteMany({
      where: {
        $or: [
          { expiresAt: { $lt: new Date() } },
          { revokedAt: { $lt: staleRevokedBefore } },
        ],
      },
    });

    const orphans = await strapi.db.query("api::refresh-token.refresh-token").findMany({
      where: { user: null },
      select: ["id"],
    });

    if (!orphans.length) return count;

    const { count: orphanCount } = await strapi.db.query("api::refresh-token.refresh-token").deleteMany({
      where: { id: { $in: orphans.map((row: { id: number }) => row.id) } },
    });

    return count + orphanCount;
  },
});
