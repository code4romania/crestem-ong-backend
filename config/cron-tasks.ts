import { computeProgramStatus } from '../src/api/program/utils/status';
import { toDateString, todayInBucharest } from '../src/utils/date';

const REPORT_UID = 'api::report.report' as const;
const PROGRAM_UID = 'api::program.program' as const;

export default {
  cleanupRefreshTokens: {
    task: async ({ strapi }: { strapi: any }) => {
      const removed = await strapi
        .service('api::refresh-token.refresh-token')
        .cleanup();
      if (removed) {
        strapi.log.info(`[cron] Removed ${removed} stale refresh tokens.`);
      }
    },
    options: {
      rule: '0 3 * * *',
    },
  },
  /**
   * Mark program reports as finished once every phase they serve has ended.
   * A report shared by two programs stays open until the later phase closes.
   * Independent reports are only closed manually.
   * Runs every day at midnight, Romanian time.
   */
  finishExpiredProgramReports: {
    task: async ({ strapi }: { strapi: any }) => {
      const reports: any[] = await strapi.documents(REPORT_UID).findMany({
        filters: { finished: false },
        populate: { phases: true },
      });
      const today = todayInBucharest();
      let closed = 0;
      for (const report of reports) {
        const phases: any[] = report.phases ?? [];
        if (phases.length === 0) {
          continue;
        }
        if (phases.every((phase) => toDateString(phase.endDate) < today)) {
          await strapi.documents(REPORT_UID).update({
            documentId: report.documentId,
            data: {
              finished: true,
              finishedAt: new Date().toISOString(),
              closedBy: 'auto',
            },
          });
          closed += 1;
        }
      }
      if (closed) {
        strapi.log.info(`[cron] Finished ${closed} expired program reports.`);
      }
    },
    options: {
      rule: '0 0 * * *',
      tz: 'Europe/Bucharest',
    },
  },
  updateProgramStatuses: {
    task: async ({ strapi }: { strapi: any }) => {
      const today = todayInBucharest();
      const programs: any[] = await strapi.documents(PROGRAM_UID).findMany({
        filters: { programStatus: { $ne: 'Finished' } },
      });
      for (const program of programs) {
        if (!program.startDate || !program.endDate) {
          continue;
        }
        const programStatus = computeProgramStatus(
          toDateString(program.startDate),
          toDateString(program.endDate),
          today,
        );
        if (programStatus === program.programStatus) {
          continue;
        }
        try {
          await strapi.documents(PROGRAM_UID).update({
            documentId: program.documentId,
            data: { programStatus },
          });
          strapi.log.info(
            `[cron] Program ${program.documentId} status updated to ${programStatus}.`,
          );
        } catch (error) {
          strapi.log.error(
            `[cron] Failed to update status for program ${program.documentId}:`,
            error,
          );
        }
      }
    },
    options: {
      rule: '0 0 * * *',
      tz: 'Europe/Bucharest',
    },
  },
};
