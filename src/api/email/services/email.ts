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

export interface SendMigratedAccountActivationArgs {
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

export interface SendOngDeletedArgs {
  to: string;
  nume: string;
  ongName: string;
}

export interface EmailService {
  sendAccountActivation(args: SendAccountActivationArgs): Promise<void>;
  sendMemberActivation(args: SendMemberActivationArgs): Promise<void>;
  sendMigratedAccountActivation(
    args: SendMigratedAccountActivationArgs,
  ): Promise<void>;
  sendPasswordReset(args: SendPasswordResetArgs): Promise<void>;
  sendProgramAssignment(args: SendProgramAssignmentArgs): Promise<void>;
  sendEvaluationInvite(args: SendEvaluationInviteArgs): Promise<void>;
  sendOngDeleted(args: SendOngDeletedArgs): Promise<void>;
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
          `Tocmai ți-a fost creat un cont de ${roleLabel} pe platforma Creștem ONG.`,
          "Pentru a-l activa, accesează linkul de mai jos și setează-ți parola:",
          "",
          link,
          "",
          "Linkul este valabil 7 zile și poate fi folosit o singură dată.",
          "Dacă nu ai solicitat/nu dorești crearea acestui cont, te rugăm să ignori acest email.",
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
          "Dacă nu dorești să dai curs acestei invitații, te rugăm să ignori acest email.",
        ]),
      });
  },
  /**
   * Sent once, to the organization administrators carried over from the old
   * platform. The wording differs from `sendAccountActivation` on purpose:
   * nobody created these accounts for them — they already had one, and the
   * "un administrator ți-a creat un cont" copy would read as a mistake.
   */
  async sendMigratedAccountActivation({
    to,
    nume,
    ongName,
    link,
  }: SendMigratedAccountActivationArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: "Contul tău Creștem ONG a fost mutat pe noua platformă",
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          "Platforma Creștem ONG s-a mutat într-o versiune nouă.",
          `Contul tău și datele organizației ${ongName} au fost transferate: organizația, rapoartele și evaluările completate până acum sunt toate acolo.`,
          "",
          "Din motive de siguranță, parola veche nu a fost transferată. Ca să intri, accesează linkul de mai jos și setează-ți o parolă nouă:",
          "",
          link,
          "",
          "Linkul este valabil 7 zile și poate fi folosit o singură dată. Dacă expiră, poți cere unul nou din pagina de autentificare, cu „Am uitat parola”.",
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
          "Dacă nu ai cerut resetarea parolei, poți ignora acest email.",
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
          "",
          "Autentifică-te în platformă și descoperă instrumentele și resursele disponibile pentru organizația ta.",
        ]),
      });
  },
  /**
   * Sent to the members of an organization that has just been deleted (BR-33).
   *
   * The wording names no author: the deletion can be run by the organization's
   * own contact person or by FDSC staff, and the same text has to hold in both
   * cases. It also has to hold whether the member keeps other memberships or
   * has just been demoted to `individual` by `removeOngMembership`, so the
   * role is not mentioned either.
   */
  async sendOngDeleted({ to, nume, ongName }: SendOngDeletedArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: `Organizația ${ongName} a fost ștearsă`,
        ...renderEmail([
          `Bună, ${nume},`,
          "",
          `Organizația ${ongName} a fost ștearsă de pe platforma Creștem ONG în urma unei solicitări.`,
          "",
          "Contul tău în platformă rămâne activ, ai pierdut doar accesul la datele și programele acestei organizații. Orice altă organizație din care faci parte rămâne neschimbată.",
          "",
          "Te poți autentifica în continuare și poți cere alăturarea la o altă organizație.",
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
          `Organizația ${ongName} a pornit o sesiune de evaluare pe platforma Creștem ONG și te-a invitat să o completezi.`,
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
          "Dacă nu ai cerut tu schimbarea, ignoră acest email și schimbă-ți parola.",
        ]),
      });
  },
});
