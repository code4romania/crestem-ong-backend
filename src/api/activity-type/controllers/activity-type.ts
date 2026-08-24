import { factories } from '@strapi/strapi';
import { Context } from "koa";

export default factories.createCoreController(
  'api::activity-type.activity-type',
  ({ strapi }) => ({
    async list(ctx: Context) {
      if (!ctx.state.user) {
        return ctx.unauthorized();
      }
      const activityTypes = await strapi
        .documents("api::activity-type.activity-type")
        .findMany({ sort: { name: "asc" } });
      return {
        data: activityTypes.map((activityType) => ({
          documentId: activityType.documentId,
          name: activityType.name,
        })),
      };
    },
  }),
);
