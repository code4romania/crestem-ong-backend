import { Context } from "koa";
import { updateIndividualSchema } from "../../admin-user/validation/admin-user";
import { LocalitateService } from "../../localitate/services/localitate";
import { docRef } from "../../../utils/relations";

export default {
  async me(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const user = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: { id: ctx.state.user.id },
      populate: ["judet", "localitate"],
    });
    return {
      data: {
        nume: user.nume,
        email: user.email,
        createdAt: user.createdAt,
        judet: user.judet
          ? { documentId: user.judet.documentId, nume: user.judet.nume }
          : null,
        localitate: user.localitate
          ? { documentId: user.localitate.documentId, nume: user.localitate.nume }
          : null,
      },
    };
  },

  async updateMe(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const parsed = await updateIndividualSchema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const { nume, judet, localitate } = parsed.data;

    if (judet && localitate) {
      const isCityCountyValid = await (
        strapi.service("api::localitate.localitate") as LocalitateService
      ).checkCityBelongsToCounty(localitate, judet);
      if (!isCityCountyValid) {
        return ctx.badRequest(
          "Localitatea selectată nu aparține județului ales",
        );
      }
    }

    // `parsed.data` never contains `email` or `role` — the schema doesn't
    // define them, so an individual can't use this to change either. judet
    // and localitate are only included when the request sent both — omitting
    // them leaves the existing relation untouched rather than clearing it.
    //
    // This goes through the Document Service API (not the users-permissions
    // plugin's `service("user").edit`, which is a thin wrapper around
    // `strapi.db.query(...).update()`) because that lower-level query layer
    // expects relations as raw numeric ids, not the `{ documentId }` shorthand
    // `docRef` produces — passed through `.edit()` it silently drops the relation.
    await strapi.documents("plugin::users-permissions.user").update({
      documentId: ctx.state.user.documentId,
      data: {
        nume,
        ...(judet && localitate
          ? { judet: docRef(judet), localitate: docRef(localitate) }
          : {}),
      },
    });

    return { message: "Profilul a fost actualizat cu succes." };
  },
};
