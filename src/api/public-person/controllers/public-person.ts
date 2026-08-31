import { Context } from "koa";
import {
  applyProgrammeAndLimit,
  buildProgramMap,
  parsePeopleQuery,
  toDirectoryPerson,
  type DirectoryUser,
  type ProgramWithMentors,
} from "../utils/people";

/**
 * Read-only people directory for the public-site page builder ("People
 * Collection" block). FDSC-staff only for now (see routes) — a real public
 * surface arrives when the `page` content type does. People are
 * `users-permissions.user` rows: mentors + FDSC staff, active and unblocked.
 */
export default {
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const { roleTypes, programIds, sort, limit } = parsePeopleQuery(
      ctx.query as Record<string, unknown>,
    );

    const users = (await strapi
      .documents("plugin::users-permissions.user")
      .findMany({
        filters: {
          role: { type: { $in: roleTypes } },
          accountStatus: "active",
          blocked: false,
        },
        sort:
          sort === "recente"
            ? { createdAt: "desc" }
            : { nume: sort === "za" ? "desc" : "asc" },
        populate: { avatar: true, role: true },
        limit: -1,
      })) as unknown as DirectoryUser[];

    const programs = (await strapi
      .documents("api::program.program")
      .findMany({
        populate: { mentors: true },
        limit: -1,
      })) as unknown as ProgramWithMentors[];

    const programMap = buildProgramMap(programs);
    const people = applyProgrammeAndLimit(
      users.map((user) => toDirectoryPerson(user, programMap)),
      { programIds, limit },
    );

    return { data: people };
  },

  async programs(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const programs = await strapi.documents("api::program.program").findMany({
      sort: { name: "asc" },
      limit: -1,
    });

    return {
      data: programs.map((program) => ({
        documentId: program.documentId,
        name: program.name,
      })),
    };
  },
};
