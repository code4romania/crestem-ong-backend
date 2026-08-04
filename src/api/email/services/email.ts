import type { Core } from "@strapi/strapi";

export interface SendMentorActivationArgs {
  to: string;
  nume: string;
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

export interface EmailService {
  sendMentorActivation(args: SendMentorActivationArgs): Promise<void>;
  sendMemberActivation(args: SendMemberActivationArgs): Promise<void>;
  sendPasswordReset(args: SendPasswordResetArgs): Promise<void>;
  sendProgramAssignment(args: SendProgramAssignmentArgs): Promise<void>;
}

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  async sendMentorActivation({ to, nume, link }: SendMentorActivationArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: "Activează-ți contul de mentor",
        text: [
          `Bună, ${nume},`,
          "",
          "Un administrator ți-a creat un cont de mentor pe platforma Creștem ONG.",
          "Pentru a-l activa, accesează linkul de mai jos și setează-ți parola:",
          "",
          link,
          "",
          "Linkul este valabil 7 zile și poate fi folosit o singură dată.",
          "Dacă nu te așteptai la acest email, poți să îl ignori.",
        ].join("\n"),
      });
  },
  async sendMemberActivation({ to, nume, ongName, link }: SendMemberActivationArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: `Ai fost invitat în organizația ${ongName}`,
        text: [
          `Bună, ${nume},`,
          "",
          `Ai fost invitat în organizația ${ongName} pe platforma Creștem ONG.`,
          "Pentru a-ți activa contul, accesează linkul de mai jos și setează-ți parola:",
          "",
          link,
          "",
          "Linkul este valabil 7 zile și poate fi folosit o singură dată.",
          "Dacă nu te așteptai la acest email, poți să îl ignori.",
        ].join("\n"),
      });
  },
  async sendPasswordReset({ to, nume, link }: SendPasswordResetArgs) {
    await strapi
      .plugin("email")
      .service("email")
      .send({
        to,
        subject: "Resetează-ți parola",
        text: [
          `Bună, ${nume},`,
          "",
          "Am primit o cerere de resetare a parolei pentru contul tău de pe platforma Creștem ONG.",
          "Pentru a seta o parolă nouă, accesează linkul de mai jos:",
          "",
          link,
          "",
          "Linkul este valabil 1 oră și poate fi folosit o singură dată.",
          "Dacă nu ai cerut resetarea parolei, poți ignora acest email.",
        ].join("\n"),
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
        text: [
          `Bună, ${nume},`,
          "",
          `Organizația ta, ${ongName}, a fost înscrisă în programul ${programName} pe platforma Creștem ONG.`,
          "Te poți autentifica în platformă pentru mai multe detalii.",
        ].join("\n"),
      });
  },
});
