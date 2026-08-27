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
  StaffCreatePayload,
  ActivateAccountPayload,
  InviteCreateResult,
  InviteResendResult,
  ResetPasswordPayload,
  ChangePasswordPayload,
  RequestEmailChangePayload,
  ConfirmEmailChangePayload,
  DeleteAccountPayload,
} from "../interfaces/auth";
import { docRef } from "../../../utils/relations";
import { setNgoMemberRole } from "../../../utils/membership";
import { EmailService } from "../../email/services/email";
import { RefreshTokenService } from "../../refresh-token/services/refresh-token";
import { performAccountDeletion } from "./delete-account";
import {
  ACTIVATION_PURPOSE,
  ActivationTokenPayload,
  getEmailLinkSecret,
  signActivationToken,
  buildActivationLink,
  exposeActivationLink,
  ACTIVATION_PATH,
  STAFF_ROLE_LABELS,
  RESET_PURPOSE,
  AuthTokenPayload,
  signResetToken,
  buildResetLink,
  EMAIL_CHANGE_PURPOSE,
  EmailChangeTokenPayload,
  signEmailChangeToken,
  buildEmailChangeLink,
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
    ong: { id: number; documentId: string; name: string },
  ): Promise<InviteCreateResult>;
  createStaff(data: StaffCreatePayload): Promise<InviteCreateResult>;
  activateAccount(data: ActivateAccountPayload): Promise<boolean>;
  resendMentorInvite(userId: number): Promise<InviteResendResult>;
  resendMemberInvite(
    userId: number,
    ongId: number,
  ): Promise<InviteResendResult>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(data: ResetPasswordPayload): Promise<boolean>;
  changePassword(
    userId: number,
    data: ChangePasswordPayload,
    userAgent?: string,
  ): Promise<{ jwt: string; refreshToken: string }>;
  /**
   * Mint a one-time link that switches the account to `data.email`. The address
   * is only applied once the link is confirmed, so a typo can never lock the
   * account out. Returns the link itself only while invitation emails are
   * unavailable (`DEV_EXPOSE_ACTIVATION_LINK`).
   */
  requestEmailChange(
    userId: number,
    data: RequestEmailChangePayload,
  ): Promise<{ confirmationLink?: string }>;
  /** Address a pending token would switch to, for the confirmation screen. */
  previewEmailChange(token: string): Promise<{ email: string }>;
  confirmEmailChange(
    data: ConfirmEmailChangePayload,
  ): Promise<{ email: string }>;
  /**
   * Anonymize the caller's own account (BR-24). Throws with a Romanian message
   * when a precondition fails — wrong password, or a role that must be handed
   * over first.
   */
  deleteAccount(userId: number, data: DeleteAccountPayload): Promise<void>;
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
            judet: docRef(data.judet),
            localitate: docRef(data.localitate),
            ngoStatus: "active",
          },
        });

        // 2. Create the account
        await strapi
          .plugin("users-permissions")
          .service("user")
          .add({
            nume: data.nume,
            email: data.email,
            password: data.password,
            telefon: data.telefon,
            acordTermeniSiConditii: data.acordTermeniSiConditii,
            provider: "local",
            confirmed: true,
            blocked: false,
            role: role.id,
            ong: [ong.id],
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
            bio: data.bio,
            avatar: data.avatar,
            dimensiuni: data.dimensiuni,
            ariiDeExpertiza: data.ariiDeExpertiza,
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
      ).sendAccountActivation({
        to: data.email,
        nume: data.nume,
        roleLabel: "mentor",
        link: buildActivationLink(token, ACTIVATION_PATH),
      });
    } catch (error) {
      console.error("createMentor email delivery failed", error);
      emailSent = false;
    }

    return {
      id: user.id,
      emailSent,
      ...(exposeActivationLink()
        ? { activationLink: buildActivationLink(token, ACTIVATION_PATH) }
        : {}),
    };
  },
  async createMember(
    data: MemberCreatePayload,
    ong: { id: number; documentId: string; name: string },
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
            ong: [ong.id],
          });

        if (!created.documentId) {
          throw new Error(
            "Contul de membru a fost creat fără documentId, rolul în organizație nu poate fi salvat.",
          );
        }

        if (data.rol) {
          await setNgoMemberRole(
            strapi,
            created.documentId,
            ong.documentId,
            data.rol,
          );
        }

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
        link: buildActivationLink(token, ACTIVATION_PATH),
      });
    } catch (error) {
      console.error("createMember email delivery failed", error);
      console.warn(
        "Member activation link (email delivery failed):",
        buildActivationLink(token, ACTIVATION_PATH),
      );
      emailSent = false;
    }

    return {
      id: user.id,
      emailSent,
      ...(exposeActivationLink()
        ? { activationLink: buildActivationLink(token, ACTIVATION_PATH) }
        : {}),
    };
  },
  async createStaff(data: StaffCreatePayload): Promise<InviteCreateResult> {
    let user: { id: number };
    let token: string;

    try {
      const result = await strapi.db.transaction(async () => {
        const role = await strapi.db
          .query("plugin::users-permissions.role")
          .findOne({ where: { type: data.role } });

        if (!role) {
          throw new Error(
            `Rolul "${data.role}" nu a fost găsit. Verifică inițializarea rolurilor în bootstrap.`,
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
      console.error("createStaff failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }

    let emailSent = true;
    try {
      await (
        strapi.service("api::email.email") as EmailService
      ).sendAccountActivation({
        to: data.email,
        nume: data.nume,
        roleLabel: STAFF_ROLE_LABELS[data.role],
        link: buildActivationLink(token, ACTIVATION_PATH),
      });
    } catch (error) {
      console.error("createStaff email delivery failed", error);
      emailSent = false;
    }

    return {
      id: user.id,
      emailSent,
      ...(exposeActivationLink()
        ? { activationLink: buildActivationLink(token, ACTIVATION_PATH) }
        : {}),
    };
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
      !["mentor", "ngo-member", "super-admin", "editor-fdsc"].includes(
        user.role?.type,
      ) ||
      user.accountStatus !== "pending" ||
      user.resetPasswordToken !== data.token
    ) {
      throw new Error("Link de activare invalid sau expirat");
    }

    try {
      await strapi.plugin("users-permissions").service("user").edit(user.id, {
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

    let emailSent = true;
    try {
      await (
        strapi.service("api::email.email") as EmailService
      ).sendAccountActivation({
        to: user.email,
        nume: user.nume,
        roleLabel: "mentor",
        link: buildActivationLink(token, ACTIVATION_PATH),
      });
    } catch (error) {
      console.error("resendMentorInvite email delivery failed", error);
      console.warn(
        "Mentor activation link (email delivery failed):",
        buildActivationLink(token, ACTIVATION_PATH),
      );
      emailSent = false;
    }

    return {
      emailSent,
      ...(exposeActivationLink()
        ? { activationLink: buildActivationLink(token, ACTIVATION_PATH) }
        : {}),
    };
  },
  async resendMemberInvite(userId: number, ongId: number) {
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { id: userId },
        populate: ["role", "ong"],
      });

    if (
      !user ||
      user.role?.type !== "ngo-member" ||
      !(user.ong ?? []).some((entry: any) => entry.id === ongId)
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

    let emailSent = true;
    try {
      await (
        strapi.service("api::email.email") as EmailService
      ).sendMemberActivation({
        to: user.email,
        nume: user.nume,
        ongName:
          (user.ong ?? []).find((entry: any) => entry.id === ongId)?.name ??
          "",
        link: buildActivationLink(token, ACTIVATION_PATH),
      });
    } catch (error) {
      console.error("resendMemberInvite email delivery failed", error);
      console.warn(
        "Member activation link (email delivery failed):",
        buildActivationLink(token, ACTIVATION_PATH),
      );
      emailSent = false;
    }

    return {
      emailSent,
      ...(exposeActivationLink()
        ? { activationLink: buildActivationLink(token, ACTIVATION_PATH) }
        : {}),
    };
  },
  async forgotPassword(email: string) {
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { email: { $eqi: email } },
        populate: ["role", "ong"],
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
        ).sendAccountActivation({
          to: user.email,
          nume: user.nume,
          roleLabel: "mentor",
          link: buildActivationLink(token, ACTIVATION_PATH),
        });

        return;
      }

      if (user.role?.type === "super-admin" || user.role?.type === "editor-fdsc") {
        const token = signActivationToken(user.id);

        await strapi
          .plugin("users-permissions")
          .service("user")
          .edit(user.id, { resetPasswordToken: token });

        await (
          strapi.service("api::email.email") as EmailService
        ).sendAccountActivation({
          to: user.email,
          nume: user.nume,
          roleLabel: STAFF_ROLE_LABELS[user.role.type as "super-admin" | "editor-fdsc"],
          link: buildActivationLink(token, ACTIVATION_PATH),
        });

        return;
      }

      if (
        user.role?.type === "ngo-member" &&
        (user.ong ?? []).length > 0
      ) {
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
          ongName: (user.ong ?? [])[0]?.name ?? "",
          link: buildActivationLink(token, ACTIVATION_PATH),
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

    await (
      strapi.service("api::email.email") as EmailService
    ).sendPasswordReset({
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

  async requestEmailChange(userId: number, data: RequestEmailChangePayload) {
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

    if (user.email.toLowerCase() === data.email) {
      throw new Error("Aceasta este deja adresa contului tău");
    }

    try {
      const token = signEmailChangeToken(user.id, data.email);

      // Storing the token makes it single-use and invalidates any earlier
      // request, the same way `resetPasswordToken` guards password resets.
      await strapi
        .plugin("users-permissions")
        .service("user")
        .edit(user.id, { emailChangeToken: token });

      return exposeActivationLink()
        ? { confirmationLink: buildEmailChangeLink(token) }
        : {};
    } catch (error) {
      console.error("requestEmailChange failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }
  },

  async previewEmailChange(token: string) {
    const { newEmail } = await verifyEmailChangeToken(strapi, token);
    return { email: newEmail };
  },

  async confirmEmailChange(data: ConfirmEmailChangePayload) {
    const { user, newEmail } = await verifyEmailChangeToken(strapi, data.token);

    // Re-checked here, not just at request time: the address may have been
    // claimed by another account while the link sat unopened.
    const taken = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { email: { $eqi: newEmail } } });

    if (taken && taken.id !== user.id) {
      throw new Error("Există deja un cont cu această adresă de email");
    }

    try {
      await strapi
        .plugin("users-permissions")
        .service("user")
        .edit(user.id, {
          email: newEmail,
          emailChangeToken: null,
          // Strapi matches the login identifier against email *or* username,
          // so a username left holding the old address would keep working.
          ...(user.username ? { username: newEmail } : {}),
        });

      await (
        strapi.service(
          "api::refresh-token.refresh-token",
        ) as RefreshTokenService
      ).revokeAllForUser(user.id);

      return { email: newEmail };
    } catch (error) {
      console.error("confirmEmailChange failed", error);
      throw new Error("A apărut o eroare necunoscută");
    }
  },

  async deleteAccount(userId: number, data: DeleteAccountPayload) {
    await performAccountDeletion(strapi, userId, data);
  },
});

/**
 * Shared guard for the two token-facing steps: valid signature, right purpose,
 * still the token we handed out, and an account that may still use it.
 */
async function verifyEmailChangeToken(strapi: Core.Strapi, token: string) {
  let payload: EmailChangeTokenPayload;

  try {
    payload = jwt.verify(
      token,
      getEmailLinkSecret(),
    ) as EmailChangeTokenPayload;
  } catch (error) {
    throw new Error("Link de confirmare invalid sau expirat");
  }

  if (payload.purpose !== EMAIL_CHANGE_PURPOSE || !payload.newEmail) {
    throw new Error("Link de confirmare invalid sau expirat");
  }

  const user = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({ where: { id: payload.id } });

  if (
    !user ||
    user.accountStatus !== "active" ||
    user.emailChangeToken !== token
  ) {
    throw new Error("Link de confirmare invalid sau expirat");
  }

  return { user, newEmail: payload.newEmail };
}
