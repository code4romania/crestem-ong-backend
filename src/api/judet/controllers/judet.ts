/**
 * judet controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";

export default factories.createCoreController(
  "api::judet.judet",
  ({ strapi }) => ({
    async list() {
      const judete = await strapi.documents("api::judet.judet").findMany({
        sort: { nume: "asc" },
        limit: -1,
      });
      return {
        data: judete.map((judet) => ({
          documentId: judet.documentId,
          nume: judet.nume,
          abreviere: judet.abreviere,
        })),
      };
    },
    async cities(ctx: Context) {
      const judet = await strapi.documents("api::judet.judet").findOne({
        documentId: ctx.params.documentId,
      });
      if (!judet) {
        return ctx.badRequest("Județul nu există");
      }
      const localitati = await strapi
        .documents("api::localitate.localitate")
        .findMany({
          filters: { judet: { documentId: judet.documentId } },
          sort: { nume: "asc" },
          limit: -1,
        });
      return {
        data: localitati.map((localitate) => ({
          documentId: localitate.documentId,
          nume: localitate.nume,
        })),
      };
    },
  }),
);
