import { Context } from "koa";
import { pageSlice } from "../../../utils/pagination";
import {
  updateMentorSchema,
  updateStaffSchema,
} from "../validation/admin-user";
import {
  ADMIN_USER_FORBIDDEN_MESSAGE,
  canActOnUser,
  canEditUser,
  resolveAdminUserRoleFilter,
} from "../utils/access";
import {
  EMPTY_EXPORT,
  HELD_STATUS,
  MEETINGS_COLUMNS,
  meetingRow,
  meetingsFileName,
} from "../utils/meetings-export";
import { isAnonymized } from "../../../utils/anonymize";
import { todayInBucharest } from "../../../utils/date";
import { textParam } from "../../../utils/query-params";
import { renderTableWorkbook } from "../../../utils/xlsx-table";

const PAGE_SIZE = 20;
const EDITABLE_ROLES = ["mentor", "super-admin", "editor-fdsc"] as const;

const SORT_OPTIONS: Record<string, Record<string, "asc" | "desc">> = {
  "nume:asc": { nume: "asc" },
  "createdAt:desc": { createdAt: "desc" },
};
const DEFAULT_SORT = SORT_OPTIONS["nume:asc"];

type OrgRef = { documentId: string; name: string };
type ProgramWithOngs = { documentId: string; name: string; ongs: OrgRef[] };

// Mentor <-> program assignment lives on the ngo-mentor join content-type — the
// user model has no direct relation to filter or populate — so resolve it separately.
// Each ngo-mentor row also carries the ong the mentor was assigned within that
// program, so a mentor mentoring the same program for two ongs shows up as two
// rows here; they're grouped back into one program entry with both ongs listed.
export async function resolveProgramsByMentor(mentorIds: string[]) {
  const programsByMentor = new Map<string, ProgramWithOngs[]>();
  if (mentorIds.length === 0) return programsByMentor;

  const rows = await strapi.documents("api::ngo-mentor.ngo-mentor").findMany({
    filters: { mentors: { documentId: { $in: mentorIds } } },
    populate: { program: true, ong: true, mentors: true },
  });
  for (const row of rows as any[]) {
    const rowPrograms = Array.isArray(row.program)
      ? row.program
      : row.program
        ? [row.program]
        : [];
    const rowOngs: OrgRef[] = Array.isArray(row.ong)
      ? row.ong
      : row.ong
        ? [row.ong]
        : [];
    for (const mentor of (row.mentors ?? []) as any[]) {
      if (!mentorIds.includes(mentor.documentId)) continue;
      const existing = programsByMentor.get(mentor.documentId) ?? [];
      for (const program of rowPrograms) {
        let entry = existing.find((p) => p.documentId === program.documentId);
        if (!entry) {
          entry = {
            documentId: program.documentId,
            name: program.name,
            ongs: [],
          };
          existing.push(entry);
        }
        for (const ong of rowOngs) {
          if (!entry.ongs.some((o) => o.documentId === ong.documentId)) {
            entry.ongs.push({ documentId: ong.documentId, name: ong.name });
          }
        }
      }
      programsByMentor.set(mentor.documentId, existing);
    }
  }
  return programsByMentor;
}

function mapUser(user: any, programs: ProgramWithOngs[]) {
  return {
    documentId: user.documentId,
    nume: user.nume,
    email: user.email,
    accountStatus: user.accountStatus,
    role: user.role ? { type: user.role.type, name: user.role.name } : null,
    ong: (user.ong ?? []).map((ong: any) => ({
      documentId: ong.documentId,
      name: ong.name,
    })),
    avatar: user.avatar ? { id: user.avatar.id, url: user.avatar.url } : null,
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    bio: user.bio ?? null,
    dimensiuni: user.dimensiuni ?? [],
    ariiDeExpertiza: user.ariiDeExpertiza ?? [],
    programs,
  };
}

export default {
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const {
      search,
      role,
      ong,
      status,
      program,
      sort,
      page: pageParam,
    } = ctx.query;

    const parsedPage = Number(pageParam);
    const page =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const searchTerm = typeof search === "string" ? search.trim() : "";
    const roleType = resolveAdminUserRoleFilter(
      ctx.state.user.role?.type,
      typeof role === "string" ? role.trim() : "",
    );
    const ongId = typeof ong === "string" ? ong.trim() : "";
    const accountStatus = typeof status === "string" ? status.trim() : "";
    const programId = typeof program === "string" ? program.trim() : "";
    const sortOrder =
      typeof sort === "string" && SORT_OPTIONS[sort]
        ? SORT_OPTIONS[sort]
        : DEFAULT_SORT;

    // Mentor <-> program assignment lives on the ngo-mentor join content-type — the
    // user model has no direct relation to filter on — so resolve matching mentor
    // ids up front when a program filter is requested.
    let programMentorIds: string[] | null = null;
    if (programId) {
      const rows = await strapi
        .documents("api::ngo-mentor.ngo-mentor")
        .findMany({
          filters: { program: { documentId: programId } },
          populate: { mentors: true },
        });
      const idSet = new Set<string>();
      for (const row of rows as any[]) {
        for (const mentor of (row.mentors ?? []) as any[]) {
          idSet.add(mentor.documentId);
        }
      }
      programMentorIds = [...idSet];
    }

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
      ...(programMentorIds ? { documentId: { $in: programMentorIds } } : {}),
    };

    const [users, total] = await Promise.all([
      strapi.documents("plugin::users-permissions.user").findMany({
        filters,
        sort: sortOrder,
        populate: { role: true, ong: true, avatar: true },
        ...pageSlice(page, PAGE_SIZE),
      }),
      strapi.documents("plugin::users-permissions.user").count({ filters }),
    ]);

    const mentorIds = users
      .filter((user) => user.role?.type === "mentor")
      .map((user) => user.documentId);

    const programsByMentor = await resolveProgramsByMentor(mentorIds);

    return {
      data: users.map((user) =>
        mapUser(user, programsByMentor.get(user.documentId) ?? []),
      ),
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

  async findOne(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const documentId = ctx.params.documentId as string;

    const user = await strapi
      .documents("plugin::users-permissions.user")
      .findOne({
        documentId,
        populate: { role: true, ong: true, avatar: true },
      });

    if (!user) {
      return ctx.notFound("Utilizatorul nu a fost găsit");
    }

    if (!canActOnUser(ctx.state.user.role?.type, user.role?.type)) {
      return ctx.forbidden(ADMIN_USER_FORBIDDEN_MESSAGE);
    }

    const programsByMentor =
      user.role?.type === "mentor"
        ? await resolveProgramsByMentor([user.documentId])
        : new Map();

    return {
      data: mapUser(user, programsByMentor.get(user.documentId) ?? []),
    };
  },

  async update(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const documentId = ctx.params.documentId as string;

    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: { documentId },
        populate: ["role"],
      });

    if (!user) {
      return ctx.notFound("Utilizatorul nu a fost găsit");
    }

    const roleType = user.role?.type as
      | (typeof EDITABLE_ROLES)[number]
      | undefined;
    if (!roleType || !EDITABLE_ROLES.includes(roleType)) {
      return ctx.badRequest(
        "Acest tip de cont nu poate fi editat din acest ecran.",
      );
    }

    if (!canEditUser(ctx.state.user.role?.type)) {
      return ctx.forbidden(ADMIN_USER_FORBIDDEN_MESSAGE);
    }

    const schema =
      roleType === "mentor" ? updateMentorSchema : updateStaffSchema;
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

  /**
   * "Descarcă jurnalul" on "Persoane resursă": every meeting held, newest
   * first, as an `.xlsx`. With `mentor`, that resource person's meetings with
   * every organization and in every program; otherwise everyone's, under the
   * screen's search (as `list` matches it) and program filter.
   */
  async exportMeetings(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }

    const search = textParam(ctx.query.search);
    const program = textParam(ctx.query.program);
    const mentorId = textParam(ctx.query.mentor);

    const filters: Record<string, unknown> = { status: HELD_STATUS };
    let mentorName: string | undefined;
    if (mentorId) {
      const mentor = await strapi
        .documents("plugin::users-permissions.user")
        .findOne({ documentId: mentorId, populate: { role: true } });
      if (!mentor || mentor.role?.type !== "mentor") {
        return ctx.badRequest("Persoana resursă nu există");
      }
      mentorName = isAnonymized(mentor) ? "cont sters" : mentor.nume;
      filters.mentor = { documentId: mentorId };
    } else {
      if (search) {
        filters.mentor = {
          $or: [
            { nume: { $containsi: search } },
            { ong: { cui: { $containsi: search } } },
          ],
        };
      }
      if (program) {
        filters.program = { documentId: program };
      }
    }

    const meetings = await strapi.documents("api::meeting.meeting").findMany({
      filters,
      sort: { dataOra: "desc" },
      populate: { ong: true, mentor: true, program: true, report: true },
    });

    if (meetings.length === 0) {
      // Not a failure: the screen shows it as information, not as an error.
      return ctx.notFound(
        mentorId
          ? "Această persoană resursă nu are încă întâlniri efectuate."
          : "Nu există întâlniri efectuate pentru filtrele selectate.",
        { reason: EMPTY_EXPORT },
      );
    }

    const today = todayInBucharest();
    const fileName = meetingsFileName(today, mentorName);
    ctx.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    ctx.set("Content-Disposition", `attachment; filename="${fileName}"`);
    ctx.body = await renderTableWorkbook({
      sheetName: "Jurnal de activitate",
      columns: MEETINGS_COLUMNS,
      rows: (meetings as any[]).map((meeting) =>
        meetingRow(meeting, ctx.request.origin),
      ),
    });
  },
};
