/**
 * ong controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";

export default factories.createCoreController("api::ong.ong", ({ strapi }) => ({
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ongs = await strapi.documents("api::ong.ong").findMany({
      sort: { name: "asc" },
      populate: { judet: true, localitate: true },
    });
    return {
      data: ongs.map((ong) => ({
        documentId: ong.documentId,
        name: ong.name,
        cui: ong.cui,
        website: ong.website,
        adresa: ong.adresa,
        dataInfiintare: ong.dataInfiintare,
        domeniuActivitate: ong.domeniuActivitate,
        judet: ong.judet
          ? { documentId: ong.judet.documentId, nume: ong.judet.nume }
          : null,
        localitate: ong.localitate
          ? {
              documentId: ong.localitate.documentId,
              nume: ong.localitate.nume,
            }
          : null,
      })),
    };
  },
  async listActive(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const ongs = await strapi.documents("api::ong.ong").findMany({
      filters: { ngoStatus: "active" },
      sort: { name: "asc" },
    });
    return {
      data: ongs.map((ong) => ({
        documentId: ong.documentId,
        name: ong.name,
      })),
    };
  },
  async members(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const user = await strapi
      .documents("plugin::users-permissions.user")
      .findOne({
        documentId: ctx.state.user.documentId,
        populate: { ong: true },
      });
    if (!user?.ong) {
      return { data: [] };
    }
    const members = await strapi
      .documents("plugin::users-permissions.user")
      .findMany({
        filters: {
          ong: { documentId: user.ong.documentId },
          role: { type: "ngo-member" },
        },
        sort: { nume: "asc" },
      });
    return {
      data: members.map((member) => ({
        documentId: member.documentId,
        nume: member.nume,
        email: member.email,
        accountStatus: member.accountStatus,
      })),
    };
  },
}));
