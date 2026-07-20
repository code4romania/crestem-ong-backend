/**
 * A set of functions called "actions" for `auth`
 */
import { Context } from "koa";
import {
  registerNgoSchema,
  registerIndividualSchema,
  registerMentorSchema,
  activateMentorSchema,
  refreshTokenSchema,
} from "../validation/auth";
import { LocalitateService } from "../../localitate/services/localitate";
import { AuthService } from "../services/auth";
import { RefreshTokenService } from "../../refresh-token/services/refresh-token";

export default {
  async registerNgo(ctx: Context) {
    try {
      const data = ctx.request.body;

      // Verify against zod schema (async: includes email/CUI uniqueness checks)
      const parsed = await registerNgoSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      // Verify that the city-county combination is valid
      const isCityCountyValid = await (
        strapi.service("api::localitate.localitate") as LocalitateService
      ).checkCityBelongsToCounty(parsed.data.localitate, parsed.data.judet);
      if (!isCityCountyValid) {
        return ctx.badRequest(
          "Localitatea selectată nu aparține județului ales",
        );
      }

      // Create entities (use normalized/validated data, not the raw body)
      await strapi.service("api::auth.auth").createNgo(parsed.data);
      return {
        message: "Contul a fost creat cu succes",
      };
    } catch (error) {
      console.error("registerNgo failed", error);
      return ctx.badRequest(
        "A apărut o eroare neașteptată în timpul înregistrării. Te rugăm să încerci din nou mai târziu.",
      );
    }
  },
  async registerIndividual(ctx: Context) {
    try {
      const data = ctx.request.body;

      // Verify against zod schema (async: includes email uniqueness check)
      const parsed = await registerIndividualSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      // Create entities (use normalized/validated data, not the raw body)
      await (strapi.service("api::auth.auth") as AuthService).createIndividual(
        parsed.data,
      );
      return {
        message: "Contul a fost creat cu succes",
      };
    } catch (error) {
      console.error("registerIndividual failed", error);
      return ctx.badRequest(
        "A apărut o eroare neașteptată în timpul înregistrării. Te rugăm să încerci din nou mai târziu.",
      );
    }
  },
  async registerMentor(ctx: Context) {
    try {
      const data = ctx.request.body;

      const parsed = await registerMentorSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).createMentor(parsed.data);

      return {
        message: result.emailSent
          ? "Contul de mentor a fost creat. Invitația a fost trimisă pe email."
          : "Contul de mentor a fost creat, dar invitația nu a putut fi trimisă. Retrimite invitația.",
        id: result.id,
        status: result.status,
        emailSent: result.emailSent,
      };
    } catch (error) {
      console.error("registerMentor failed", error);
      return ctx.badRequest(
        "A apărut o eroare neașteptată în timpul înregistrării. Te rugăm să încerci din nou mai târziu.",
      );
    }
  },
  async activateMentor(ctx: Context) {
    try {
      const data = ctx.request.body;

      const parsed = await activateMentorSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      await (strapi.service("api::auth.auth") as AuthService).activateMentor(
        parsed.data,
      );

      return {
        message: "Contul a fost activat cu succes. Te poți autentifica acum.",
      };
    } catch (error) {
      console.error("activateMentor failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async resendMentorInvite(ctx: Context) {
    try {
      const userId = Number(ctx.params.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return ctx.badRequest("Identificator invalid");
      }

      await (
        strapi.service("api::auth.auth") as AuthService
      ).resendMentorInvite(userId);

      return {
        message: "Invitația a fost retrimisă.",
      };
    } catch (error) {
      console.error("resendMentorInvite failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async refresh(ctx: Context) {
    const parsed = await refreshTokenSchema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    try {
      const { userId, refreshToken } = await (
        strapi.service("api::refresh-token.refresh-token") as RefreshTokenService
      ).rotate(parsed.data.refreshToken, ctx.request.header["user-agent"]);

      const jwt = strapi
        .plugin("users-permissions")
        .service("jwt")
        .issue({ id: userId });

      return { jwt, refreshToken };
    } catch (error) {
      console.error("refresh failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async logout(ctx: Context) {
    const parsed = await refreshTokenSchema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    try {
      await (
        strapi.service("api::refresh-token.refresh-token") as RefreshTokenService
      ).revoke(parsed.data.refreshToken);
    } catch (error) {
      console.error("logout failed", error);
    }

    return { message: "Delogare reușită" };
  },
};
