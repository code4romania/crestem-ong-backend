/**
 * footer controller
 */

import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { updateFooterSchema } from "../validation/footer";

const POPULATE = { socials: true } as const;

const footerView = (footer: any) => ({
  description: footer?.description ?? "",
  copyright: footer?.copyright ?? "",
  socials: (footer?.socials ?? []).map((social: any) => ({
    platform: social.platform,
    // Only a custom network carries one; the rest are named by their platform.
    ...(social.label ? { label: social.label } : {}),
    url: social.url,
  })),
});

export default factories.createCoreController("api::footer.footer", ({ strapi }) => ({
  async detail() {
    const footer = await strapi
      .documents("api::footer.footer")
      .findFirst({ populate: POPULATE });

    // Seeded at bootstrap, so this only guards a database that predates it: the
    // site still renders, with the columns and nothing on the left.
    return { data: footerView(footer) };
  },

  async updateOne(ctx: Context) {
    const parsed = updateFooterSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const existing = await strapi.documents("api::footer.footer").findFirst();
    if (!existing) return ctx.notFound("Footerul nu există");

    const updated = await strapi.documents("api::footer.footer").update({
      documentId: existing.documentId,
      data: parsed.data as any,
      populate: POPULATE,
    });

    return { data: footerView(updated) };
  },
}));
