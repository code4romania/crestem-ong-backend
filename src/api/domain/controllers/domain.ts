/**
 * domain controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::domain.domain",
  ({ strapi }) => ({
    async list() {
      const domains = await strapi.documents("api::domain.domain").findMany({
        sort: { name: "asc" },
        limit: -1,
      });
      return {
        data: domains.map((domain) => ({
          documentId: domain.documentId,
          name: domain.name,
        })),
      };
    },
  }),
);
