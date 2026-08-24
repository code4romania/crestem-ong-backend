import { isClosed } from "../../report/utils/lifecycle";

export interface FdscDashboard {
  ongCount: number;
  finishedReportCount: number;
  activeProgramCount: number;
  fdscReportCount: number;
}

/**
 * The four counters on the FDSC "Panou principal".
 *
 * `ongCount` drops the organizations that deleted their profile — they render as
 * "Retras" everywhere else (BR-33) — but keeps blocked ones, which are still
 * registered organizations.
 *
 * "Evaluări finalizate" uses `isClosed`, not the raw `finished` column: a round
 * attached to program phases closes when its last phase ends and keeps
 * `finished: false` in the database. Counting the column alone would report 0
 * while the organization's own pages show the round as finalized.
 */
export async function buildFdscDashboard(
  strapi: any,
  today: string,
): Promise<FdscDashboard> {
  const [ongCount, reports, activeProgramCount, fdscReportCount] =
    await Promise.all([
      strapi
        .documents("api::ong.ong")
        .count({ filters: { ngoStatus: { $ne: "deleted" } } }),
      strapi
        .documents("api::report.report")
        .findMany({ populate: { phases: true } }),
      strapi
        .documents("api::program.program")
        .count({ filters: { programStatus: "Active" } }),
      strapi.documents("api::fdsc-report.fdsc-report").count({}),
    ]);

  return {
    ongCount,
    finishedReportCount: ((reports ?? []) as any[]).filter((report) =>
      isClosed(report, today),
    ).length,
    activeProgramCount,
    fdscReportCount,
  };
}
