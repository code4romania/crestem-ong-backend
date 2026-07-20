const REPORT_UID = 'api::report.report' as const;

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
   * Mark reports as finished once their deadline has passed.
   * Runs every day at midnight.
   */
  updateExpiredReports: {
    task: async ({ strapi }: { strapi: any }) => {
      const reports: any[] = await strapi.documents(REPORT_UID).findMany({
        filters: { finished: false },
      });
      const today = new Date();
      for (const report of reports) {
        if (!report.deadline) {
          continue;
        }

        const deadlineDate = new Date(report.deadline);
        if (today.getTime() >= deadlineDate.getTime()) {
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
};
