/**
 * A set of functions called "actions" for `auth`
 */
import { registerNgoSchema, registerIndividualSchema } from "../validation/auth";

export default {
  async registerNgo(ctx: any) {
    try {
      const data = ctx.request.body;

      // Verify against zod schema (async: includes email/CUI uniqueness checks)
      const parsed = await registerNgoSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      // Verify that the city-county combination is valid
      const isCityCountyValid = await strapi
        .service("api::localitate.localitate")
        .checkCityBelongsToCounty(data.localitate, data.judet);
      if (!isCityCountyValid) {
        return ctx.badRequest(
          "Localitatea selectată nu aparține județului ales",
        );
      }

      // Create entities
      await strapi.service("api::auth.auth").createNgo(data);
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
  async registerIndividual(ctx: any) {
    try {
      const data = ctx.request.body;

      // Verify against zod schema (async: includes email uniqueness check)
      const parsed = await registerIndividualSchema.safeParseAsync(data);
      if (!parsed.success) {
        return ctx.badRequest("Date invalide: ", parsed.error.flatten());
      }

      // Create entities
      await strapi.service("api::auth.auth").createIndividual(data);
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
};
