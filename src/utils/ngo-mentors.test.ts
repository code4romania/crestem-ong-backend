import { describe, expect, it } from "vitest";
import { mentorView } from "./ngo-mentors";

const activeMentor = {
  documentId: "m-1",
  nume: "Ana Pop",
  email: "ana@example.org",
  mentorJobTitle: "Consultant",
  mentorOrganization: "Acme",
  avatar: { documentId: "f-1", name: "ana.png", url: "/uploads/ana.png" },
  accountStatus: "active",
};

describe("mentorView", () => {
  it("passes an active mentor through untouched", () => {
    expect(mentorView(activeMentor)).toEqual({
      documentId: "m-1",
      nume: "Ana Pop",
      email: "ana@example.org",
      mentorJobTitle: "Consultant",
      mentorOrganization: "Acme",
      avatar: { documentId: "f-1", name: "ana.png", url: "/uploads/ana.png" },
      isDeleted: false,
    });
  });

  // BR-34: the assignment survives the deletion, so this view is still built —
  // it just has to render as a person who is no longer there.
  it("marks a deleted mentor and drops every contact field", () => {
    const view = mentorView({
      ...activeMentor,
      nume: "Anonim m-1",
      email: "deleted-m-1@anonim.local",
      accountStatus: "deleted",
    });

    expect(view.isDeleted).toBe(true);
    expect(view.email).toBeNull();
    expect(view.mentorJobTitle).toBeNull();
    expect(view.mentorOrganization).toBeNull();
    expect(view.avatar).toBeNull();
  });

  // BR-27 is what names the person; the view must not invent a label of its own.
  it("keeps the anonymized name exactly as it is stored", () => {
    const view = mentorView({
      documentId: "m-2",
      nume: "Anonim m-2",
      accountStatus: "deleted",
    });

    expect(view.nume).toBe("Anonim m-2");
  });
});
