import type { Core } from "@strapi/strapi";

export interface SendMentorActivationArgs {
  to: string;
  nume: string;
  link: string;
}

export interface EmailService {
  sendMentorActivation(args: SendMentorActivationArgs): Promise<void>;
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
});
