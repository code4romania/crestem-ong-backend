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
  MentorActivatePayload,
  MentorCreateResult,
} from "../interfaces/auth";
import { EmailService } from "../../email/services/email";
import { RefreshTokenService } from "../../refresh-token/services/refresh-token";

const ACTIVATION_PURPOSE = "mentor-activation";
const INVALID_ACTIVATION = "Link de activare invalid sau expirat";

type ActivationTokenPayload = {
  id: number;
  purpose: string;
};

const getActivationSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET nu este configurat.");
  }
  return secret;
};

const signActivationToken = (userId: number) =>
  jwt.sign({ id: userId, purpose: ACTIVATION_PURPOSE }, getActivationSecret(), {
    expiresIn: process.env.MENTOR_ACTIVATION_TTL || "7d",
  } as jwt.SignOptions);

const buildActivationLink = (token: string) => {
  const base = process.env.FRONTEND_URL || "http://localhost:1337";
  return `${base.replace(/\/+$/, "")}/mentor/activare?token=${encodeURIComponent(token)}`;
};

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
  createMentor(data: MentorCreatePayload): Promise<MentorCreateResult>;
  activateMentor(data: MentorActivatePayload): Promise<boolean>;
  resendMentorInvite(userId: number): Promise<boolean>;
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
            judet: data.judet,
            localitate: data.localitate,
            acordTermeniSiConditii: data.acordTermeniSiConditii,
          },
        });

        // 2. Create the account
        await strapi.plugin("users-permissions").service("user").add({
          nume: data.nume,
          email: data.email,
          password: data.password,
          telefon: data.telefon,
          provider: "local",
          confirmed: true,
          blocked: false,
          role: role.id,
          ong: ong.id,
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
  async createMentor(data: MentorCreatePayload): Promise<MentorCreateResult> {
    let user: { id: number; status: string };
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
            status: "pending",
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
        link: buildActivationLink(token),
      });
    } catch (error) {
      console.error("createMentor email delivery failed", error);
      emailSent = false;
    }

    return { id: user.id, status: "pending", emailSent };
  },
  async activateMentor(data: MentorActivatePayload) {
    let payload: ActivationTokenPayload;

    try {
      payload = jwt.verify(
        data.token,
        getActivationSecret(),
      ) as ActivationTokenPayload;
    } catch (error) {
      throw new Error(INVALID_ACTIVATION);
    }

    if (payload.purpose !== ACTIVATION_PURPOSE) {
      throw new Error(INVALID_ACTIVATION);
    }

    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: payload.id }, populate: ["role"] });

    if (
      !user ||
      user.role?.type !== "mentor" ||
      user.status !== "pending" ||
      user.resetPasswordToken !== data.token
    ) {
      throw new Error(INVALID_ACTIVATION);
    }

    try {
      await strapi
        .plugin("users-permissions")
        .service("user")
        .edit(user.id, {
          password: data.password,
          status: "active",
          resetPasswordToken: null,
        });

      await (
        strapi.service(
          "api::refresh-token.refresh-token",
        ) as RefreshTokenService
      ).revokeAllForUser(user.id);

      return true;
    } catch (error) {
      console.error("activateMentor failed", error);
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

    if (user.status !== "pending") {
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
      link: buildActivationLink(token),
    });

    return true;
  },
});
