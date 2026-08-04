import {
  computeProgramStatus,
  toDateString,
  todayInBucharest,
} from '../src/api/program/utils/status';

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
   * Mark reports as finished once their phase (or program) end date has passed.
   * Standalone reports are only closed manually.
   * Runs every day at midnight.
   */
  updateExpiredReports: {
    task: async ({ strapi }: { strapi: any }) => {
      const reports: any[] = await strapi.documents(REPORT_UID).findMany({
        filters: { finished: false },
        populate: { phase: true, program: true },
      });
      const today = new Date().toISOString().slice(0, 10);
      for (const report of reports) {
        const endDate = report.phase?.endDate ?? report.program?.endDate;
        if (!endDate) {
          continue;
        }
        if (`${endDate}` < today) {
          await strapi.documents(REPORT_UID).update({
            documentId: report.documentId,
            data: { finished: true },
          });
        }
      }
    },
    options: {
      rule: '0 0 * * *',
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
