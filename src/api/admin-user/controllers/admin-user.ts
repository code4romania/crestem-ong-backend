import { Context } from "koa";
import {
  buildActivationLink,
  exposeActivationLink,
  ACTIVATION_PATH,
} from "../../auth/utils/auth";
import { pendingActivationTokens } from "../../../utils/activation";
import { updateMentorSchema, updateStaffSchema } from "../validation/admin-user";

const PAGE_SIZE = 20;
const EDITABLE_ROLES = ["mentor", "super-admin", "editor-fdsc"] as const;

export default {
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const { search, role, ong, status, page: pageParam } = ctx.query;

    const parsedPage = Number(pageParam);
    const page =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const searchTerm = typeof search === "string" ? search.trim() : "";
    const roleType = typeof role === "string" ? role.trim() : "";
    const ongId = typeof ong === "string" ? ong.trim() : "";
    const accountStatus = typeof status === "string" ? status.trim() : "";

    const filters: Record<string, unknown> = {
      ...(searchTerm
        ? {
            $or: [
              { nume: { $containsi: searchTerm } },
              { ong: { cui: { $containsi: searchTerm } } },
            ],
          }
        : {}),
      ...(roleType ? { role: { type: roleType } } : {}),
      ...(ongId ? { ong: { documentId: ongId } } : {}),
      ...(accountStatus ? { accountStatus } : {}),
    };

    const [users, total] = await Promise.all([
      strapi.documents("plugin::users-permissions.user").findMany({
        filters,
        sort: { nume: "asc" },
        populate: { role: true, ong: true, avatar: true },
        pagination: { page, pageSize: PAGE_SIZE },
      }),
      strapi.documents("plugin::users-permissions.user").count({ filters }),
    ]);

    const activationTokens = exposeActivationLink()
      ? await pendingActivationTokens(
          strapi,
          users.map((user) => user.documentId),
        )
      : new Map<string, string>();

    return {
      data: users.map((user) => {
        const activationToken = activationTokens.get(user.documentId);
        return {
          documentId: user.documentId,
          nume: user.nume,
          email: user.email,
          accountStatus: user.accountStatus,
          role: user.role ? { type: user.role.type, name: user.role.name } : null,
          ong: (user.ong ?? []).map((ong) => ({
            documentId: ong.documentId,
            name: ong.name,
          })),
          avatar: user.avatar ? { id: user.avatar.id, url: user.avatar.url } : null,
          lastLoginAt: user.lastLoginAt ?? null,
          bio: user.bio ?? null,
          dimensiuni: user.dimensiuni ?? [],
          ariiDeExpertiza: user.ariiDeExpertiza ?? [],
          ...(activationToken
            ? { activationLink: buildActivationLink(activationToken, ACTIVATION_PATH) }
            : {}),
        };
      }),
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

  async update(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const documentId = ctx.params.documentId as string;

    const user = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: { documentId },
      populate: ["role"],
    });

    if (!user) {
      return ctx.notFound("Utilizatorul nu a fost găsit");
    }

    const roleType = user.role?.type as (typeof EDITABLE_ROLES)[number] | undefined;
    if (!roleType || !EDITABLE_ROLES.includes(roleType)) {
      return ctx.badRequest("Acest tip de cont nu poate fi editat din acest ecran.");
    }

    const schema = roleType === "mentor" ? updateMentorSchema : updateStaffSchema;
    const parsed = await schema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }

    // `parsed.data` never contains `email` — the schemas don't define it, so it can't
    // reach the update call no matter what the client sends.
    await strapi
      .plugin("users-permissions")
      .service("user")
      .edit(user.id, parsed.data);

    return { message: "Utilizatorul a fost actualizat cu succes." };
  },
};
