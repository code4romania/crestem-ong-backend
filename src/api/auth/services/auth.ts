/**
 * auth service
 */
import type { Core } from "@strapi/strapi";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  NgoCreatePayload,
  IndividualCreatePayload,
  MentorCreatePayload,
  MemberCreatePayload,
  ActivateAccountPayload,
  InviteCreateResult,
  ResetPasswordPayload,
  ChangePasswordPayload,
} from "../interfaces/auth";
import { docRef } from "../../../utils/relations";
import { EmailService } from "../../email/services/email";
import { RefreshTokenService } from "../../refresh-token/services/refresh-token";
import {
  ACTIVATION_PURPOSE,
  ActivationTokenPayload,
  getEmailLinkSecret,
  signActivationToken,
  buildActivationLink,
  MENTOR_ACTIVATION_PATH,
  MEMBER_ACTIVATION_PATH,
  RESET_PURPOSE,
  AuthTokenPayload,
  signResetToken,
  buildResetLink,
} from "../utils/auth";

export interface AuthService {
  /**
   * Create a new organization (ONG) account along with its associated user ("ngo-admin").
   *
   * @param data - Details about the NGO and administrator account.
   * @returns Promise<boolean> - Resolves to true if creation succeeds; throws otherwise.
   */
  createNgo(data: NgoCreatePayload): Promise<boolean>;
  /**
   * Create a new individual user account ("individual" role).
   *
   * @param data - Details about the individual user to create.
   * @returns Promise<boolean> - Resolves to true if creation succeeds; throws otherwise.
   */
  createIndividual(data: IndividualCreatePayload): Promise<boolean>;
  createMentor(data: MentorCreatePayload): Promise<InviteCreateResult>;
  createMember(
    data: MemberCreatePayload,
    ong: { id: number; name: string },
  ): Promise<InviteCreateResult>;
  activateAccount(data: ActivateAccountPayload): Promise<boolean>;
  resendMentorInvite(userId: number): Promise<boolean>;
  resendMemberInvite(userId: number, ongId: number): Promise<boolean>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(data: ResetPasswordPayload): Promise<boolean>;
  changePassword(
    userId: number,
    data: ChangePasswordPayload,
    userAgent?: string,
  ): Promise<{ jwt: string; refreshToken: string }>;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async createNgo(data: NgoCreatePayload) {
    try {
      return await strapi.db.transaction(async () => {
        // Get the roles
        const role = await strapi.db
          .query("plugin::users-permissions.role")
          .findOne({ where: { type: "ngo-admin" } });

        if (!role) {
          throw new Error(
            'Rolul "ngo-admin" nu a fost găsit. Verifică inițializarea rolurilor în bootstrap.',
          );
        }

        // 1. Create the organization
        const ong = await strapi.documents("api::ong.ong").create({
          data: {
            name: data.numeOng,
            cui: data.cui,
            website: data.website,
            judet: docRef(data.judet),
            localitate: docRef(data.localitate),
            ngoStatus: "active",
          },
        });

        // 2. Create the account
        await strapi.plugin("users-permissions").service("user").add({
          nume: data.nume,
          email: data.email,
          password: data.password,
          telefon: data.telefon,
          acordTermeniSiConditii: data.acordTermeniSiConditii,
          provider: "local",
          confirmed: true,
          blocked: false,
          role: role.id,
          ongs: [ong.id],
        });

        return true;
      });
    } catch (error) {
      console.error("createNgo failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }
  },
  async createIndividual(data: IndividualCreatePayload) {
    try {
      // Get the roles
      const role = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "individual" } });

      if (!role) {
        throw new Error(
          'Rolul "individual" nu a fost găsit. Verifică inițializarea rolurilor în bootstrap.',
        );
      }

      // Check if

      await strapi.plugin("users-permissions").service("user").add({
        nume: data.nume,
        email: data.email,
        password: data.password,
        telefon: data.telefon,
        acordTermeniSiConditii: data.acordTermeniSiConditii,
        provider: "local",
        confirmed: true,
        blocked: false,
        role: role.id,
      });

      return true;
    } catch (error) {
      console.error("AUTH_SERVICE_ERROR: ", error);
      throw new Error("A apărut o eroare necunoscută");
    }
  },
  async createMentor(data: MentorCreatePayload): Promise<InviteCreateResult> {
    let user: { id: number };
    let token: string;

    try {
      const result = await strapi.db.transaction(async () => {
        const role = await strapi.db
          .query("plugin::users-permissions.role")
          .findOne({ where: { type: "mentor" } });

        if (!role) {
          throw new Error(
            'Rolul "mentor" nu a fost găsit. Verifică inițializarea rolurilor în bootstrap.',
          );
        }

        const created = await strapi
          .plugin("users-permissions")
          .service("user")
          .add({
            nume: data.nume,
            email: data.email,
            telefon: data.telefon,
            password: crypto.randomBytes(32).toString("hex"),
            provider: "local",
            accountStatus: "pending",
            confirmed: true,
            blocked: false,
            role: role.id,
          });

        const activationToken = signActivationToken(created.id);

        await strapi
          .plugin("users-permissions")
          .service("user")
          .edit(created.id, { resetPasswordToken: activationToken });

        return { created, activationToken };
      });

      user = result.created;
      token = result.activationToken;
    } catch (error) {
      console.error("createMentor failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }

    let emailSent = true;
    try {
      await (
        strapi.service("api::email.email") as EmailService
      ).sendMentorActivation({
        to: data.email,
        nume: data.nume,
        link: buildActivationLink(token, MENTOR_ACTIVATION_PATH),
      });
    } catch (error) {
      console.error("createMentor email delivery failed", error);
      emailSent = false;
    }

    return { id: user.id, emailSent };
  },
  async createMember(
    data: MemberCreatePayload,
    ong: { id: number; name: string },
  ): Promise<InviteCreateResult> {
    let user: { id: number };
    let token: string;

    try {
      const result = await strapi.db.transaction(async () => {
        const role = await strapi.db
          .query("plugin::users-permissions.role")
          .findOne({ where: { type: "ngo-member" } });

        if (!role) {
          throw new Error(
            'Rolul "ngo-member" nu a fost găsit. Verifică inițializarea rolurilor în bootstrap.',
          );
        }

        const created = await strapi
          .plugin("users-permissions")
          .service("user")
          .add({
            nume: data.nume,
            email: data.email,
            telefon: data.telefon,
            password: crypto.randomBytes(32).toString("hex"),
            provider: "local",
            accountStatus: "pending",
            confirmed: true,
            blocked: false,
            role: role.id,
            ongs: [ong.id],
          });

        const activationToken = signActivationToken(created.id);

        await strapi
          .plugin("users-permissions")
          .service("user")
          .edit(created.id, { resetPasswordToken: activationToken });

        return { created, activationToken };
      });

      user = result.created;
      token = result.activationToken;
    } catch (error) {
      console.error("createMember failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }

    let emailSent = true;
    try {
      await (
        strapi.service("api::email.email") as EmailService
      ).sendMemberActivation({
        to: data.email,
        nume: data.nume,
        ongName: ong.name,
        link: buildActivationLink(token, MEMBER_ACTIVATION_PATH),
      });
    } catch (error) {
      console.error("createMember email delivery failed", error);
      emailSent = false;
    }

    return { id: user.id, emailSent };
  },
  async activateAccount(data: ActivateAccountPayload) {
    let payload: ActivationTokenPayload;

    try {
      payload = jwt.verify(
        data.token,
        getEmailLinkSecret(),
      ) as ActivationTokenPayload;
    } catch (error) {
      throw new Error("Link de activare invalid sau expirat");
    }

    if (payload.purpose !== ACTIVATION_PURPOSE) {
      throw new Error("Link de activare invalid sau expirat");
    }

    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: payload.id }, populate: ["role"] });

    if (
      !user ||
      !["mentor", "ngo-member"].includes(user.role?.type) ||
      user.accountStatus !== "pending" ||
      user.resetPasswordToken !== data.token
    ) {
      throw new Error("Link de activare invalid sau expirat");
    }

    try {
      await strapi
        .plugin("users-permissions")
        .service("user")
        .edit(user.id, {
          password: data.password,
          accountStatus: "active",
          resetPasswordToken: null,
        });

      await (
        strapi.service(
          "api::refresh-token.refresh-token",
        ) as RefreshTokenService
      ).revokeAllForUser(user.id);

      return true;
    } catch (error) {
      console.error("activateAccount failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }
  },
  async resendMentorInvite(userId: number) {
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: userId }, populate: ["role"] });

    if (!user || user.role?.type !== "mentor") {
      throw new Error("Contul de mentor nu a fost găsit");
    }

    if (user.accountStatus !== "pending") {
      throw new Error("Contul este deja activat");
    }

    const token = signActivationToken(user.id);

    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(user.id, { resetPasswordToken: token });

    await (
      strapi.service("api::email.email") as EmailService
    ).sendMentorActivation({
      to: user.email,
      nume: user.nume,
      link: buildActivationLink(token, MENTOR_ACTIVATION_PATH),
    });

    return true;
  },
  async resendMemberInvite(userId: number, ongId: number) {
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: userId }, populate: ["role", "ongs"] });

    if (
      !user ||
      user.role?.type !== "ngo-member" ||
      !(user.ongs ?? []).some((entry: any) => entry.id === ongId)
    ) {
      throw new Error("Contul de membru nu a fost găsit");
    }

    if (user.accountStatus !== "pending") {
      throw new Error("Contul este deja activat");
    }

    const token = signActivationToken(user.id);

    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(user.id, { resetPasswordToken: token });

    await (
      strapi.service("api::email.email") as EmailService
    ).sendMemberActivation({
      to: user.email,
      nume: user.nume,
      ongName:
        (user.ongs ?? []).find((entry: any) => entry.id === ongId)?.name ?? "",
      link: buildActivationLink(token, MEMBER_ACTIVATION_PATH),
    });

    return true;
  },
  async forgotPassword(email: string) {
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { email: { $eqi: email } },
        populate: ["role", "ongs"],
      });

    if (!user || user.accountStatus === "deleted") {
      return;
    }

    if (user.accountStatus === "pending") {
      if (user.role?.type === "mentor") {
        const token = signActivationToken(user.id);

        await strapi
          .plugin("users-permissions")
          .service("user")
          .edit(user.id, { resetPasswordToken: token });

        await (
          strapi.service("api::email.email") as EmailService
        ).sendMentorActivation({
          to: user.email,
          nume: user.nume,
          link: buildActivationLink(token, MENTOR_ACTIVATION_PATH),
        });

        return;
      }

      if (user.role?.type === "ngo-member" && (user.ongs ?? []).length > 0) {
        const token = signActivationToken(user.id);

        await strapi
          .plugin("users-permissions")
          .service("user")
          .edit(user.id, { resetPasswordToken: token });

        await (
          strapi.service("api::email.email") as EmailService
        ).sendMemberActivation({
          to: user.email,
          nume: user.nume,
          ongName: (user.ongs ?? [])[0]?.name ?? "",
          link: buildActivationLink(token, MEMBER_ACTIVATION_PATH),
        });

        return;
      }

      return;
    }

    const token = signResetToken(user.id);

    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(user.id, { resetPasswordToken: token });

    await (strapi.service("api::email.email") as EmailService).sendPasswordReset({
      to: user.email,
      nume: user.nume,
      link: buildResetLink(token),
    });
  },
  async resetPassword(data: ResetPasswordPayload) {
    let payload: AuthTokenPayload;

    try {
      payload = jwt.verify(
        data.token,
        getEmailLinkSecret(),
      ) as AuthTokenPayload;
    } catch (error) {
      throw new Error("Link de resetare invalid sau expirat");
    }

    if (payload.purpose !== RESET_PURPOSE) {
      throw new Error("Link de resetare invalid sau expirat");
    }

    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: payload.id } });

    if (
      !user ||
      user.accountStatus !== "active" ||
      user.resetPasswordToken !== data.token
    ) {
      throw new Error("Link de resetare invalid sau expirat");
    }

    try {
      await strapi
        .plugin("users-permissions")
        .service("user")
        .edit(user.id, { password: data.password, resetPasswordToken: null });

      await (
        strapi.service(
          "api::refresh-token.refresh-token",
        ) as RefreshTokenService
      ).revokeAllForUser(user.id);

      return true;
    } catch (error) {
      console.error("resetPassword failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }
  },
  async changePassword(
    userId: number,
    data: ChangePasswordPayload,
    userAgent?: string,
  ) {
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: userId } });

    if (!user || user.accountStatus !== "active") {
      throw new Error("Contul nu a fost găsit");
    }

    const isCurrentPasswordValid = await strapi
      .plugin("users-permissions")
      .service("user")
      .validatePassword(data.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new Error("Parola actuală este incorectă");
    }

    if (data.currentPassword === data.password) {
      throw new Error("Parola nouă trebuie să fie diferită de cea actuală");
    }

    try {
      await strapi
        .plugin("users-permissions")
        .service("user")
        .edit(user.id, { password: data.password });

      const refreshTokenService = strapi.service(
        "api::refresh-token.refresh-token",
      ) as RefreshTokenService;

      await refreshTokenService.revokeAllForUser(user.id);
      const refreshToken = await refreshTokenService.issue(user.id, userAgent);

      const accessToken = strapi
        .plugin("users-permissions")
        .service("jwt")
        .issue({ id: user.id });

      return { jwt: accessToken, refreshToken };
    } catch (error) {
      console.error("changePassword failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }
  },
});
