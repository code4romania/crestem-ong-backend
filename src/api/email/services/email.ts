import type { Core } from "@strapi/strapi";
import { toDateString } from "../../../utils/date";
import { renderEmail } from "../utils/template";

export interface SendAccountActivationArgs {
  to: string;
  nume: string;
  roleLabel: string;
  link: string;
}

export interface SendMemberActivationArgs {
  to: string;
  nume: string;
  ongName: string;
  link: string;
}

export interface SendPasswordResetArgs {
  to: string;
  nume: string;
  link: string;
}

export interface SendProgramAssignmentArgs {
  to: string;
  nume: string;
  ongName: string;
  programName: string;
}

export interface SendEmailChangeConfirmationArgs {
  to: string;
  nume: string;
  link: string;
}

export interface SendEvaluationInviteArgs {
  to: string;
  nume: string;
  ongName: string;
  link: string;
  deadline?: string;
}

export interface EmailService {
  sendAccountActivation(args: SendAccountActivationArgs): Promise<void>;
  sendMemberActivation(args: SendMemberActivationArgs): Promise<void>;
  sendPasswordReset(args: SendPasswordResetArgs): Promise<void>;
  sendProgramAssignment(args: SendProgramAssignmentArgs): Promise<void>;
  sendEvaluationInvite(args: SendEvaluationInviteArgs): Promise<void>;
  sendEmailChangeConfirmation(
    args: SendEmailChangeConfirmationArgs,
  ): Promise<void>;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async sendAccountActivation({ to, nume, roleLabel, link }: SendAccountActivationArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: `Activează-ți contul de ${roleLabel}`,
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          `Un administrator ți-a creat un cont de ${roleLabel} pe platforma Creștem ONG.`,
          "Pentru a-l activa, accesează linkul de mai jos și setează-ți parola:",
          "",
          link,
          "",
          "Linkul este valabil 7 zile și poate fi folosit o singură dată.",
        ]),
      });
  },
  async sendMemberActivation({ to, nume, ongName, link }: SendMemberActivationArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: `Ai fost invitat în organizația ${ongName}`,
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          `Ai fost invitat în organizația ${ongName} pe platforma Creștem ONG.`,
          "Pentru a-ți activa contul, accesează linkul de mai jos și setează-ți parola:",
          "",
          link,
          "",
          "Linkul este valabil 7 zile și poate fi folosit o singură dată.",
        ]),
      });
  },
  async sendPasswordReset({ to, nume, link }: SendPasswordResetArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: "Resetează-ți parola",
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          "Am primit o cerere de resetare a parolei pentru contul tău de pe platforma Creștem ONG.",
          "Pentru a seta o parolă nouă, accesează linkul de mai jos:",
          "",
          link,
          "",
          "Linkul este valabil 1 oră și poate fi folosit o singură dată.",
        ]),
      });
  },
  async sendProgramAssignment({
    to,
    nume,
    ongName,
    programName,
  }: SendProgramAssignmentArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: `Organizația ta a fost înscrisă în programul ${programName}`,
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          `Organizația ta, ${ongName}, a fost înscrisă în programul ${programName} pe platforma Creștem ONG.`,
          "Te poți autentifica în platformă pentru mai multe detalii.",
        ]),
      });
  },
  async sendEvaluationInvite({
    to,
    nume,
    ongName,
    link,
    deadline,
  }: SendEvaluationInviteArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: `Ai o evaluare de completat pentru ${ongName}`,
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          `Organizația ${ongName} a pornit o rundă de evaluare pe platforma Creștem ONG și ai fost invitat să o completezi.`,
          ...(deadline
            ? [`Termenul limită pentru completare este ${toDateString(deadline)}.`]
            : []),
          "Accesează linkul de mai jos, autentifică-te și completează evaluarea:",
          "",
          link,
          "",
          "Poți completa evaluarea pe dimensiuni, în mai multe reprize. O dimensiune trimisă nu mai poate fi modificată.",
        ]),
      });
  },
  async sendEmailChangeConfirmation({
    to,
    nume,
    link,
  }: SendEmailChangeConfirmationArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: "Confirmă noua adresă de email",
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          "Ai cerut schimbarea adresei de email a contului tău de pe platforma Creștem ONG cu aceasta.",
          "Pentru a finaliza schimbarea, accesează linkul de mai jos:",
          "",
          link,
          "",
          "Adresa contului se schimbă doar după ce deschizi linkul. Până atunci rămâi cu cea veche.",
          "Dacă nu ai cerut tu această schimbare, schimbă-ți parola.",
        ]),
      });
  },
});
