import { describe, expect, it } from "vitest";
import {
  applyProgrammeAndLimit,
  buildProgramMap,
  parsePeopleQuery,
  personTypeFor,
  toDirectoryPerson,
  type DirectoryPerson,
  type DirectoryUser,
} from "./people";

describe("personTypeFor", () => {
  it("maps mentor to persoană resursă", () => {
    expect(personTypeFor("mentor")).toBe("persoana-resursa");
  });

  it("maps every other directory role to FDSC staff", () => {
    expect(personTypeFor("editor-fdsc")).toBe("echipa-fdsc");
    expect(personTypeFor("super-admin")).toBe("echipa-fdsc");
    expect(personTypeFor(null)).toBe("echipa-fdsc");
  });
});

describe("parsePeopleQuery", () => {
  it("defaults to all directory roles, A→Z, no cap", () => {
    expect(parsePeopleQuery({})).toEqual({
      roleTypes: ["mentor", "editor-fdsc", "super-admin"],
      programIds: [],
      sort: "az",
      limit: null,
    });
  });

  it("narrows to mentors when type is persoana-resursa", () => {
    expect(parsePeopleQuery({ type: "persoana-resursa" }).roleTypes).toEqual([
      "mentor",
    ]);
  });

  it("narrows to FDSC staff when type is echipa-fdsc", () => {
    expect(parsePeopleQuery({ type: "echipa-fdsc" }).roleTypes).toEqual([
      "editor-fdsc",
      "super-admin",
    ]);
  });

  it("keeps all roles for type=toate or an unknown type", () => {
    expect(parsePeopleQuery({ type: "toate" }).roleTypes).toHaveLength(3);
    expect(parsePeopleQuery({ type: "nonsense" }).roleTypes).toHaveLength(3);
  });

  it("splits, trims and de-dupes the programme list", () => {
    expect(parsePeopleQuery({ programe: " a , b ,a, ,c" }).programIds).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("accepts only za / recente as non-default sorts", () => {
    expect(parsePeopleQuery({ sort: "za" }).sort).toBe("za");
    expect(parsePeopleQuery({ sort: "recente" }).sort).toBe("recente");
    expect(parsePeopleQuery({ sort: "az" }).sort).toBe("az");
    expect(parsePeopleQuery({ sort: "weird" }).sort).toBe("az");
  });

  it("accepts only a positive integer limit", () => {
    expect(parsePeopleQuery({ limit: "8" }).limit).toBe(8);
    expect(parsePeopleQuery({ limit: "0" }).limit).toBeNull();
    expect(parsePeopleQuery({ limit: "-4" }).limit).toBeNull();
    expect(parsePeopleQuery({ limit: "4.5" }).limit).toBeNull();
    expect(parsePeopleQuery({ limit: "all" }).limit).toBeNull();
  });
});

describe("buildProgramMap", () => {
  it("inverts program.mentors into a per-user programme list", () => {
    const map = buildProgramMap([
      {
        documentId: "p1",
        name: "Accelerator",
        mentors: [{ documentId: "u1" }, { documentId: "u2" }],
      },
      { documentId: "p2", name: "Leadership", mentors: [{ documentId: "u1" }] },
      { documentId: "p3", name: "Fără mentori", mentors: [] },
    ]);
    expect(map.get("u1")).toEqual([
      { documentId: "p1", name: "Accelerator" },
      { documentId: "p2", name: "Leadership" },
    ]);
    expect(map.get("u2")).toEqual([{ documentId: "p1", name: "Accelerator" }]);
    expect(map.has("u3")).toBe(false);
  });

  it("tolerates missing or null mentor entries", () => {
    const map = buildProgramMap([
      { documentId: "p1", name: "X", mentors: [null, { documentId: "u1" }] },
      { documentId: "p2", name: "Y", mentors: null },
    ]);
    expect(map.get("u1")).toEqual([{ documentId: "p1", name: "X" }]);
  });
});

describe("toDirectoryPerson", () => {
  const baseUser: DirectoryUser = {
    documentId: "u1",
    nume: "Ana Moldovan",
    mentorJobTitle: "Consultant",
    mentorOrganization: "EcoSens",
    createdAt: "2024-07-01T00:00:00.000Z",
    role: { type: "mentor" },
    avatar: { url: "/uploads/ana.png", name: "ana.png" },
  };

  it("shapes a mentor with their programmes and avatar", () => {
    const map = buildProgramMap([
      { documentId: "p1", name: "Accelerator", mentors: [{ documentId: "u1" }] },
    ]);
    expect(toDirectoryPerson(baseUser, map)).toEqual({
      documentId: "u1",
      nume: "Ana Moldovan",
      functie: "Consultant",
      organizatie: "EcoSens",
      tip: "persoana-resursa",
      programe: [{ documentId: "p1", name: "Accelerator" }],
      avatar: { url: "/uploads/ana.png", name: "ana.png" },
      adaugatLa: "2024-07-01T00:00:00.000Z",
    });
  });

  it("never attaches programmes to FDSC staff, even if present in the map", () => {
    const staff: DirectoryUser = {
      ...baseUser,
      documentId: "u1",
      role: { type: "editor-fdsc" },
      mentorJobTitle: null,
      mentorOrganization: null,
      avatar: null,
    };
    const map = buildProgramMap([
      { documentId: "p1", name: "Accelerator", mentors: [{ documentId: "u1" }] },
    ]);
    const shaped = toDirectoryPerson(staff, map);
    expect(shaped.tip).toBe("echipa-fdsc");
    expect(shaped.programe).toEqual([]);
    expect(shaped.functie).toBe("");
    expect(shaped.organizatie).toBe("");
    expect(shaped.avatar).toBeNull();
  });
});

describe("applyProgrammeAndLimit", () => {
  const people: DirectoryPerson[] = [
    {
      documentId: "u1",
      nume: "A",
      functie: "",
      organizatie: "",
      tip: "persoana-resursa",
      programe: [{ documentId: "p1", name: "P1" }],
      avatar: null,
      adaugatLa: "2024-01-01",
    },
    {
      documentId: "u2",
      nume: "B",
      functie: "",
      organizatie: "",
      tip: "persoana-resursa",
      programe: [{ documentId: "p2", name: "P2" }],
      avatar: null,
      adaugatLa: "2024-01-02",
    },
    {
      documentId: "u3",
      nume: "C",
      functie: "",
      organizatie: "",
      tip: "echipa-fdsc",
      programe: [],
      avatar: null,
      adaugatLa: "2024-01-03",
    },
  ];

  it("returns everything when no programme filter and no cap", () => {
    expect(
      applyProgrammeAndLimit(people, { programIds: [], limit: null }),
    ).toHaveLength(3);
  });

  it("keeps only people in one of the requested programmes", () => {
    const filtered = applyProgrammeAndLimit(people, {
      programIds: ["p2"],
      limit: null,
    });
    expect(filtered.map((p) => p.documentId)).toEqual(["u2"]);
  });

  it("caps after filtering", () => {
    const filtered = applyProgrammeAndLimit(people, {
      programIds: [],
      limit: 2,
    });
    expect(filtered.map((p) => p.documentId)).toEqual(["u1", "u2"]);
  });
});
