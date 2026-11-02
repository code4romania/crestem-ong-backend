import { NOTIFICATION_UID, type NotificationType } from "./types";

export type NotifyInput = {
  /** User ids. Deduped; falsy entries are dropped. */
  recipients: Array<number | null | undefined>;
  type: NotificationType;
  title: string;
  body: string;
  /** One link for everyone, or a function of the recipient id (role-specific links). */
  link?: string | ((recipientId: number) => string);
};

/** Creates one row per distinct recipient. Returns how many were created. */
export async function createNotifications(
  strapi: any,
  input: NotifyInput,
): Promise<number> {
  const recipients = [...new Set(input.recipients.filter(Boolean) as number[])];
  // All-or-nothing: a mid-loop failure must not leave a partial audience.
  await strapi.db.transaction(async () => {
    for (const recipientId of recipients) {
      await strapi.documents(NOTIFICATION_UID).create({
        data: {
          recipient: { connect: [{ id: recipientId }] },
          type: input.type,
          title: input.title,
          body: input.body,
          link:
            typeof input.link === "function" ? input.link(recipientId) : input.link,
        } as any,
      });
    }
  });
  return recipients.length;
}
