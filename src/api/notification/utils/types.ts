export const NOTIFICATION_TYPES = [
  "account-activated",
  "member-joined",
  "admin-transfer",
  "evaluation-completed",
  "meeting-created",
  "meeting-updated",
  "meeting-cancelled",
  "phase-ended",
  "mentor-assigned",
  "ong-added-to-program",
  "ong-registered",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_UID = "api::notification.notification";
export const USER_UID = "plugin::users-permissions.user";

/** The shape the API returns; also what the frontend renders. */
export type NotificationView = {
  documentId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};
