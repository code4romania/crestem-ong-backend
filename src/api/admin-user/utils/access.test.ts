import { describe, expect, it } from "vitest";
import {
  ADMIN_USER_FORBIDDEN_MESSAGE,
  canActOnUser,
  canEditUser,
  resolveAdminUserRoleFilter,
} from "./access";

describe("canActOnUser", () => {
  it("lets the administrator act on any editable account", () => {
    expect(canActOnUser("super-admin", "mentor")).toBe(true);
    expect(canActOnUser("super-admin", "super-admin")).toBe(true);
    expect(canActOnUser("super-admin", "editor-fdsc")).toBe(true);
  });

  it("lets the editor act on a mentor", () => {
    expect(canActOnUser("editor-fdsc", "mentor")).toBe(true);
  });

  it("stops the editor from acting on an administrator", () => {
    expect(canActOnUser("editor-fdsc", "super-admin")).toBe(false);
  });

  it("stops the editor from acting on another editor", () => {
    expect(canActOnUser("editor-fdsc", "editor-fdsc")).toBe(false);
  });

  it("stops the editor when the target role is unknown", () => {
    expect(canActOnUser("editor-fdsc", null)).toBe(false);
    expect(canActOnUser("editor-fdsc", undefined)).toBe(false);
  });

  it("stops anyone who is not FDSC staff", () => {
    expect(canActOnUser("ngo-admin", "mentor")).toBe(false);
    expect(canActOnUser(undefined, "mentor")).toBe(false);
  });

  it("exposes a Romanian refusal message", () => {
    expect(ADMIN_USER_FORBIDDEN_MESSAGE).toMatch(/permisiune/i);
  });
});

describe("canEditUser", () => {
  it("lets the administrator write", () => {
    expect(canEditUser("super-admin")).toBe(true);
  });

  it("stops the editor writing, mentor targets included", () => {
    expect(canEditUser("editor-fdsc")).toBe(false);
  });

  it("stops anyone else", () => {
    expect(canEditUser("ngo-admin")).toBe(false);
    expect(canEditUser(null)).toBe(false);
    expect(canEditUser(undefined)).toBe(false);
  });
});

describe("resolveAdminUserRoleFilter", () => {
  it("honours whatever role the administrator asked for", () => {
    expect(resolveAdminUserRoleFilter("super-admin", "mentor")).toBe("mentor");
    expect(resolveAdminUserRoleFilter("super-admin", "ngo-admin")).toBe("ngo-admin");
  });

  it("leaves the administrator unfiltered when no role is requested", () => {
    expect(resolveAdminUserRoleFilter("super-admin", "")).toBe("");
  });

  it("pins the editor to mentors even when no role is requested", () => {
    expect(resolveAdminUserRoleFilter("editor-fdsc", "")).toBe("mentor");
  });

  it("pins the editor to mentors when another role is requested", () => {
    expect(resolveAdminUserRoleFilter("editor-fdsc", "super-admin")).toBe("mentor");
  });
});
