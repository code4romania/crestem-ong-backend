/**
 * auth service
 */
import type { Core } from "@strapi/strapi";
import { NgoCreatePayload, IndividualCreatePayload } from "../interfaces/auth";

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

      await strapi.plugin("users-permissions").service("user").add({
        nume: data.nume,
        email: data.email,
        password: data.password,
        telefon: data.telefon,
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
});
