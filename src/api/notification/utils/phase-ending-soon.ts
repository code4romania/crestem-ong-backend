/**
 * Phase-ending-soon reminders: the nightly run reminds the ONG admins and the
 * active mentors of a program whose phase ends exactly `REMINDER_DAYS_BEFORE`
 * days from today.
 * There is no catch-up — a phase moved closer than that is covered by the
 * phase-dates-changed notice FDSC's edit sends instead.
 *
 * `endReminderSentFor` holds the end date the reminder went out for, so a
 * second run on the same day sends nothing, while an end date moved later
 * no longer matches it and is reminded again in its own time.
 */
import { addDays, todayInBucharest } from "../../../utils/date";
import { phaseEndingSoonMessage } from "./messages";
import { activeAmong, ongAdmins } from "./recipients";

const PHASE_UID = "api::phase.phase";
const NOTIFICATION_SERVICE = "api::notification.notification";

export const REMINDER_DAYS_BEFORE = 3;

/** The end date a reminder run on `today` looks for. */
export const reminderTargetDay = (today: string): string =>
  addDays(today, REMINDER_DAYS_BEFORE);

export async function notifyPhasesEndingSoon(strapi: any): Promise<void> {
  const target = reminderTargetDay(todayInBucharest());
  const phases: any[] = await strapi.documents(PHASE_UID).findMany({
    filters: {
      endDate: target,
      $or: [
        { endReminderSentFor: { $null: true } },
        { endReminderSentFor: { $ne: target } },
      ],
    },
    populate: {
      program: {
        fields: ["name"],
        populate: { ongs: { fields: ["id"] }, mentors: { fields: ["id"] } },
      },
    },
    limit: -1,
  });

  let reminded = 0;
  for (const phase of phases) {
    try {
      const program = phase.program;
      const recipients = program
        ? [
            ...(await ongAdmins(
              strapi,
              (program.ongs ?? []).map((ong: { id: number }) => ong.id),
            )),
            ...(await activeAmong(
              strapi,
              (program.mentors ?? []).map((mentor: { id: number }) => mentor.id),
            )),
          ]
        : [];
      // Notify + marker commit together: a failure leaves both undone.
      await strapi.db.transaction(async () => {
        if (recipients.length > 0) {
          await strapi.service(NOTIFICATION_SERVICE).notify({
            recipients,
            ...phaseEndingSoonMessage({
              phaseTitle: phase.title,
              programName: program.name,
              endDate: target,
            }),
          });
        }
        await strapi.documents(PHASE_UID).update({
          documentId: phase.documentId,
          data: { endReminderSentFor: target },
        });
      });
      reminded += 1;
    } catch (error) {
      strapi.log.error(
        `[cron] phase-ending-soon reminder for phase ${phase.documentId} failed: ${String(error)}`,
      );
    }
  }
  if (reminded) {
    strapi.log.info(`[cron] Reminded ${reminded} phase(s) ending on ${target}.`);
  }
}
