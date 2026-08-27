import { errors } from "@strapi/utils";
import type { RefreshTokenService } from "../../api/refresh-token/services/refresh-token";
import { resolveLoginTimestamps } from "./utils/login-timestamps";

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
        .findOne({
          where: { id: userId },
          select: ["accountStatus", "firstLoginAt"],
        });

      if (user && BLOCKED_STATUSES.includes(user.accountStatus)) {
        ctx.body = null;
        throw new ApplicationError(
          "Contul tău nu este activat. Verifică emailul primit.",
        );
      }

      const { isFirstLogin, data: loginTimestamps } = resolveLoginTimestamps(
        user,
        new Date(),
      );

      try {
        await strapi.db
          .query("plugin::users-permissions.user")
          .update({ where: { id: userId }, data: loginTimestamps });
      } catch (error) {
        strapi.log.error("Failed to record login timestamps", error);
      }

      const refreshToken = await (
        strapi.service(
          "api::refresh-token.refresh-token",
        ) as RefreshTokenService
      ).issue(userId, ctx.request.header["user-agent"]);

      ctx.body = { ...ctx.body, refreshToken, isFirstLogin };
    };

    return controller;
  };

  return plugin;
};
