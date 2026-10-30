import { describe, expect, it } from "vitest";
import { EDITOR_FDSC_PERMISSIONS, SUPER_ADMIN_PERMISSIONS } from "./index";

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
