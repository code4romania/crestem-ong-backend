/**
 * In-app notifications.
 *
 *   strapi.service("api::notification.notification").notify({
 *     recipients: number[],          // user ids; deduped, falsy dropped
 *     type, title, body,
 *     link?: string | ((recipientId: number) => string),
 *   }): Promise<number>              // rows created
 *
 * Per-recipient links (e.g. phase-ended: staff get `/dashboard/programe/{id}`,
 * everyone else `/dashboard/programe`) pass `link` as a function of the
 * recipient id, with one call for the whole audience.
 *
 * Recipient lists come from `../utils/recipients` (fdscAdmins, fdscStaff,
 * ongAdmins); date pieces for bodies from `../utils/format`
 * (formatRoDate, formatRoTime).
 *
 * `notify` throws on a database error. Callers wrap it in try/catch and log:
 * a notification must never fail the action that triggered it.
 */
import { factories } from "@strapi/strapi";
import { createNotifications, type NotifyInput } from "../utils/notify";

export default factories.createCoreService(
  "api::notification.notification",
  ({ strapi }) => ({
    notify: (input: NotifyInput) => createNotifications(strapi, input),
  }),
);
