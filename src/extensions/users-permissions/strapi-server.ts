import { errors } from "@strapi/utils";
import type { RefreshTokenService } from "../../api/refresh-token/services/refresh-token";

const { ApplicationError } = errors;

const BLOCKED_STATUSES = ["pending", "deleted"];

export default (plugin: any) => {
  const createAuthController = plugin.controllers.auth;

  plugin.controllers.auth = (deps: any) => {
    const controller = createAuthController(deps);
    const originalCallback = controller.callback;

    controller.callback = async (ctx: any) => {
      await originalCallback(ctx);

      const userId = ctx.body?.user?.id;
      if (!userId) return;

      const user = await strapi.db
        .query("plugin::users-permissions.user")
        .findOne({ where: { id: userId }, select: ["status"] });

      if (user && BLOCKED_STATUSES.includes(user.status)) {
        ctx.body = null;
        throw new ApplicationError(
          "Contul tău nu este activat. Verifică emailul primit.",
        );
      }

      const refreshToken = await (
        strapi.service(
          "api::refresh-token.refresh-token",
        ) as RefreshTokenService
      ).issue(userId, ctx.request.header["user-agent"]);

      ctx.body = { ...ctx.body, refreshToken };
    };

    return controller;
  };

  return plugin;
};
