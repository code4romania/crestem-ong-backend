/**
 * A set of functions called "actions" for `auth`
 */
import { Context } from "koa";
import {
  registerNgoSchema,
  registerIndividualSchema,
  registerMentorSchema,
  registerMemberSchema,
  registerStaffSchema,
  activateAccountSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  requestEmailChangeSchema,
  confirmEmailChangeSchema,
} from "../validation/auth";
import { deleteAccountSchema } from "../validation/delete-account";
import { LocalitateService } from "../../localitate/services/localitate";
import { AuthService } from "../services/auth";
import { registerOrAttachMember } from "../services/register-member";
import { RefreshTokenService } from "../../refresh-token/services/refresh-token";
import {
  loadUserWithOngs,
  requestedOng,
  resolveActingOng,
} from "../../../utils/ong-scope";

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
  async me(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: ctx.state.user.id }, populate: ["role"] });
    return {
      data: {
        id: user.id,
        documentId: user.documentId,
        nume: user.nume,
        email: user.email,
        createdAt: user.createdAt,
        role: user.role ? { type: user.role.type, name: user.role.name } : null,
      },
    };
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
        emailSent: result.emailSent,
        ...(result.activationLink
          ? { activationLink: result.activationLink }
          : {}),
      };
    } catch (error) {
      console.error("registerMentor failed", error);
      return ctx.badRequest(
        "A apărut o eroare neașteptată în timpul înregistrării. Te rugăm să încerci din nou mai târziu.",
      );
    }
  },
  async registerStaff(ctx: Context) {
    try {
      const data = ctx.request.body;

      const parsed = await registerStaffSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).createStaff(parsed.data);

      return {
        message: result.emailSent
          ? "Contul a fost creat. Invitația a fost trimisă pe email."
          : "Contul a fost creat, dar invitația nu a putut fi trimisă. Retrimite invitația.",
        id: result.id,
        emailSent: result.emailSent,
        ...(result.activationLink
          ? { activationLink: result.activationLink }
          : {}),
      };
    } catch (error) {
      console.error("registerStaff failed", error);
      return ctx.badRequest(
        "A apărut o eroare neașteptată în timpul înregistrării. Te rugăm să încerci din nou mai târziu.",
      );
    }
  },
  async registerMember(ctx: Context) {
    try {
      const parsed = await registerMemberSchema.safeParseAsync(
        ctx.request.body,
      );
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const admin = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      const scope = resolveActingOng(admin, requestedOng(ctx));
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }

      const authService = strapi.service("api::auth.auth") as AuthService;
      const result = await registerOrAttachMember(
        strapi,
        parsed.data,
        { id: scope.ong.id, documentId: scope.ong.documentId, name: scope.ong.name },
        (data, ong) => authService.createMember(data, ong),
      );

      if (result.attached === true) {
        return {
          message: "Utilizatorul avea deja un cont și a fost adăugat în organizație.",
          id: result.id,
          attached: true,
        };
      }

      return {
        message: result.emailSent
          ? "Contul de membru a fost creat. Invitația a fost trimisă pe email."
          : "Contul de membru a fost creat, dar invitația nu a putut fi trimisă. Retrimite invitația.",
        id: result.id,
        emailSent: result.emailSent,
        attached: false,
        ...(result.activationLink
          ? { activationLink: result.activationLink }
          : {}),
      };
    } catch (error) {
      console.error("registerMember failed", error);
      return ctx.badRequest(
        "A apărut o eroare neașteptată în timpul înregistrării. Te rugăm să încerci din nou mai târziu.",
      );
    }
  },
  async activate(ctx: Context) {
    try {
      const data = ctx.request.body;

      const parsed = await activateAccountSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      await (strapi.service("api::auth.auth") as AuthService).activateAccount(
        parsed.data,
      );

      return {
        message: "Contul a fost activat cu succes. Te poți autentifica acum.",
      };
    } catch (error) {
      console.error("activate failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async resendMentorInvite(ctx: Context) {
    try {
      const userId = Number(ctx.params.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return ctx.badRequest("Identificator invalid");
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).resendMentorInvite(userId);

      return {
        message: result.emailSent
          ? "Invitația a fost retrimisă."
          : "Invitația a fost regenerată, dar emailul nu a putut fi trimis.",
        emailSent: result.emailSent,
        ...(result.activationLink
          ? { activationLink: result.activationLink }
          : {}),
      };
    } catch (error) {
      console.error("resendMentorInvite failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async resendMemberInvite(ctx: Context) {
    try {
      const userId = Number(ctx.params.id);

      if (!Number.isInteger(userId) || userId <= 0) {
        return ctx.badRequest("Identificator invalid");
      }

      const admin = await loadUserWithOngs(strapi, ctx.state.user.documentId);
      const scope = resolveActingOng(admin, requestedOng(ctx));
      if ("error" in scope) {
        return ctx.badRequest(scope.error);
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).resendMemberInvite(userId, scope.ong.id);

      return {
        message: result.emailSent
          ? "Invitația a fost retrimisă."
          : "Invitația a fost regenerată, dar emailul nu a putut fi trimis.",
        emailSent: result.emailSent,
        ...(result.activationLink
          ? { activationLink: result.activationLink }
          : {}),
      };
    } catch (error) {
      console.error("resendMemberInvite failed", error);
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
  async forgotPassword(ctx: Context) {
    const parsed = await forgotPasswordSchema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    try {
      await (strapi.service("api::auth.auth") as AuthService).forgotPassword(
        parsed.data.email,
      );
    } catch (error) {
      console.error("forgotPassword failed", error);
    }

    return {
      message: "Dacă există un cont cu acest email, vei primi un link de resetare",
    };
  },
  async resetPassword(ctx: Context) {
    try {
      const parsed = await resetPasswordSchema.safeParseAsync(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      await (strapi.service("api::auth.auth") as AuthService).resetPassword(
        parsed.data,
      );

      return {
        message: "Parola a fost resetată cu succes. Te poți autentifica acum.",
      };
    } catch (error) {
      console.error("resetPassword failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async changePassword(ctx: Context) {
    try {
      const parsed = await changePasswordSchema.safeParseAsync(ctx.request.body);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).changePassword(
        ctx.state.user.id,
        parsed.data,
        ctx.request.header["user-agent"],
      );

      return { ...result, message: "Parola a fost schimbată cu succes" };
    } catch (error) {
      console.error("changePassword failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async requestEmailChange(ctx: Context) {
    try {
      const parsed = await requestEmailChangeSchema.safeParseAsync(
        ctx.request.body,
      );
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).requestEmailChange(ctx.state.user.id, parsed.data);

      return {
        ...result,
        message:
          "Am generat linkul de confirmare. Deschide-l pentru a finaliza schimbarea",
      };
    } catch (error) {
      console.error("requestEmailChange failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async previewEmailChange(ctx: Context) {
    try {
      const token = ctx.query.token;
      if (typeof token !== "string" || !token.trim()) {
        return ctx.badRequest("Tokenul este obligatoriu");
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).previewEmailChange(token);

      return { data: result };
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },
  async confirmEmailChange(ctx: Context) {
    try {
      const parsed = await confirmEmailChangeSchema.safeParseAsync(
        ctx.request.body,
      );
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      const result = await (
        strapi.service("api::auth.auth") as AuthService
      ).confirmEmailChange(parsed.data);

      return {
        ...result,
        message:
          "Adresa de email a fost schimbată. Autentifică-te cu noua adresă",
      };
    } catch (error) {
      console.error("confirmEmailChange failed", error);
      return ctx.badRequest(error.message);
    }
  },
  async deleteAccount(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const parsed = deleteAccountSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    try {
      await (strapi.service("api::auth.auth") as AuthService).deleteAccount(
        ctx.state.user.id,
        { currentPassword: parsed.data.currentPassword },
      );
      return { message: "Contul a fost șters" };
    } catch (error) {
      console.error("deleteAccount failed", error);
      // The service throws Romanian, user-facing reasons (wrong password,
      // contact person, last administrator) — surface them verbatim.
      return ctx.badRequest((error as Error).message);
    }
  },
};
