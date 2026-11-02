import { describe, expect, it } from "vitest";
import {
  EDITOR_FDSC_PERMISSIONS,
  ROLE_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
} from "./index";

// A new authenticated route 403s for everyone until its action is listed here.
const MENTOR_ACTIONS = [
  "api::admin-user.admin-user.resendInvite",
  "api::admin-user.admin-user.changeEmail",
  "api::admin-user.admin-user.remove",
];

describe("permission matrix", () => {
  it.each(MENTOR_ACTIONS)("grants %s to the super-admin only", (action) => {
    expect(SUPER_ADMIN_PERMISSIONS).toContain(action);
    expect(EDITOR_FDSC_PERMISSIONS).not.toContain(action);
  });
});

const NOTIFICATION_ACTIONS = [
  "api::notification.notification.list",
  "api::notification.notification.unreadCount",
  "api::notification.notification.markRead",
  "api::notification.notification.markAllRead",
];

describe("notification feed permissions", () => {
  it.each(["super-admin", "editor-fdsc", "ngo-admin", "mentor"])(
    "grants the feed to %s",
    (role) => {
      expect(ROLE_PERMISSIONS[role]).toEqual(expect.arrayContaining(NOTIFICATION_ACTIONS));
    },
  );

  it.each(["ngo-member", "individual"])("does not grant the feed to %s", (role) => {
    for (const action of NOTIFICATION_ACTIONS) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(action);
    }
  });
});
