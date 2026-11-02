/**
 * Phase-ended notifications. `endNotifiedAt` marks a phase whose end was
 * announced (or deliberately skipped); it is only set once the notifications
 * were created, so a failed phase retries the next night.
 */
import { todayInBucharest, toDateString } from "../../../utils/date";
import { phaseEndedMessage } from "./messages";
import type { NotifyInput } from "./notify";
import { activeAmong, fdscStaff, ongAdmins } from "./recipients";

const PHASE_UID = "api::phase.phase";
const NOTIFICATION_SERVICE = "api::notification.notification";
const STORE_KEY = "phaseEndBackfillDone";

/** Announce every phase that ended and has not been announced yet. */
export async function notifyEndedPhases(strapi: any): Promise<void> {
  const phases: any[] = await strapi.documents(PHASE_UID).findMany({
    filters: { endDate: { $lt: todayInBucharest() }, endNotifiedAt: { $null: true } },
    populate: {
      program: {
        fields: ["documentId", "name"],
        populate: { ongs: { fields: ["id"] }, mentors: { fields: ["id"] } },
      },
    },
    limit: -1,
  });

  // Same staff for every phase: look them up once per run.
  let staff: number[] = [];
  if (phases.some((phase) => phase.program)) {
    try {
      staff = await fdscStaff(strapi);
    } catch (error) {
      strapi.log.error(`[cron] phase-ended staff lookup failed: ${String(error)}`);
      return;
    }
  }

  let notified = 0;
  for (const phase of phases) {
    try {
      const program = phase.program;
      let notifyInput: NotifyInput | null = null;
      if (program) {
        const admins = await ongAdmins(
          strapi,
          (program.ongs ?? []).map((ong: { id: number }) => ong.id),
        );
        const mentors = await activeAmong(
          strapi,
          (program.mentors ?? []).map((mentor: { id: number }) => mentor.id),
        );
        const message = phaseEndedMessage({
          phaseTitle: phase.title,
          programName: program.name,
          programDocumentId: program.documentId,
          staffIds: new Set(staff),
        });
        notifyInput = { recipients: [...staff, ...admins, ...mentors], ...message };
      }
      // Notify + marker commit together: a failure leaves both undone.
      await strapi.db.transaction(async () => {
        if (notifyInput) {
          await strapi.service(NOTIFICATION_SERVICE).notify(notifyInput);
        }
        await strapi.documents(PHASE_UID).update({
          documentId: phase.documentId,
          data: { endNotifiedAt: new Date().toISOString() },
        });
      });
      notified += 1;
    } catch (error) {
      strapi.log.error(
        `[cron] phase-ended notification for phase ${phase.documentId} failed: ${String(error)}`,
      );
    }
  }
  if (notified) {
    strapi.log.info(`[cron] Announced ${notified} ended phase(s).`);
  }
}

/**
 * One-time launch backfill: phases that ended before notifications existed are
 * marked as announced so they never notify. Gated by a core store flag.
 */
export async function backfillPhaseEndNotified(strapi: any): Promise<void> {
  try {
    const store = strapi.store({ type: "core", name: "notifications" });
    if (await store.get({ key: STORE_KEY })) {
      return;
    }
    await strapi.db.query(PHASE_UID).updateMany({
      where: { endDate: { $lt: todayInBucharest() }, endNotifiedAt: null },
      data: { endNotifiedAt: new Date().toISOString() },
    });
    await store.set({ key: STORE_KEY, value: true });
  } catch (error) {
    // Never block boot; the flag stays unset so the next boot retries.
    strapi.log.error(`[bootstrap] phase-end backfill failed: ${String(error)}`);
  }
}

/**
 * Extra phase data for an FDSC write of `endDate`: a phase moved back to a
 * future (or current) date will end again, so it must be announced again.
 */
export const endNotifiedReset = (
  endDate: unknown,
): { endNotifiedAt: null } | Record<string, never> =>
  toDateString(endDate) >= todayInBucharest() ? { endNotifiedAt: null } : {};

/**
 * Extra phase data for a newly created phase: one created already in the past
 * must not announce its end, so it starts out marked as notified.
 */
export const endNotifiedOnCreate = (
  endDate: unknown,
): { endNotifiedAt: string } | Record<string, never> =>
  toDateString(endDate) < todayInBucharest()
    ? { endNotifiedAt: new Date().toISOString() }
    : {};
