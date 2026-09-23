import { factories } from "@strapi/strapi";
import { Context } from "koa";
import { submitContactSchema, updateContactStatusSchema } from "../validation/contact";

const UID = "api::contact.contact";
const PAGE_SIZE = 25;

const view = (row: any) => ({
  documentId: row.documentId,
  name: row.name,
  email: row.email,
  organization: row.organization ?? "",
  subject: row.subject,
  message: row.message,
  // Atributul se numește `contactStatus` în content-type, nu `status`:
  // `status` e rezervat de Strapi 5 pentru filtrarea draft/published și
  // blochează colecția dacă `draftAndPublish` e vreodată activat. Contractul
  // API rămâne `status`, deci frontendul nu știe de redenumire.
  status: row.contactStatus,
  consentedAt: row.consentedAt,
  createdAt: row.createdAt,
});

export default factories.createCoreController(UID, ({ strapi }) => ({
  async submit(ctx: Context) {
    const body = (ctx.request.body ?? {}) as Record<string, unknown>;

    // Honeypot: un câmp pe care un om nu-l vede și nu-l completează. Decizia
    // se ia înaintea validării de schemă și răspunde ca la un succes, fără
    // insert — un 400 i-ar confirma botului ce l-a prins.
    const website = body.website;
    if (typeof website === "string" && website.trim() !== "") {
      return { ok: true };
    }

    const { website: _website, ...rest } = body;
    const parsed = submitContactSchema.safeParse(rest);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const { name, email, organization, subject, message } = parsed.data;

    await strapi.documents(UID).create({
      data: {
        name,
        email,
        organization,
        subject,
        message,
        contactStatus: "new",
        consentedAt: new Date(),
      } as any,
    });

    // Nu returnăm entitatea: clientul n-are ce face cu ea.
    return { ok: true };
  },

  async list(ctx: Context) {
    const page = Math.max(1, Number(ctx.query.page) || 1);

    const [rows, total] = await Promise.all([
      strapi.documents(UID).findMany({
        sort: { createdAt: "desc" },
        start: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
      strapi.documents(UID).count({}),
    ]);

    return {
      data: rows.map(view),
      meta: {
        pagination: {
          page,
          pageSize: PAGE_SIZE,
          pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          total,
        },
      },
    };
  },

  async updateStatus(ctx: Context) {
    const { documentId } = ctx.params;

    const parsed = updateContactStatusSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    const existing = await strapi
      .documents(UID)
      .findOne({ documentId });
    if (!existing) return ctx.notFound("Mesajul nu există");

    // Orice tranziție e permisă, inclusiv înapoi la `new`: staff-ul trebuie să
    // poată corecta o apăsare greșită sau să redeschidă un mesaj.
    const updated = await strapi.documents(UID).update({
      documentId,
      data: { contactStatus: parsed.data.status } as any,
    });

    return { data: view(updated) };
  },

  async remove(ctx: Context) {
    const { documentId } = ctx.params;

    const existing = await strapi
      .documents(UID)
      .findOne({ documentId });
    if (!existing) return ctx.notFound("Mesajul nu există");

    await strapi.documents(UID).delete({ documentId });

    return { data: { documentId } };
  },
}));
