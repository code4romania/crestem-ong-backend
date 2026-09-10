import { describe, expect, it, vi } from "vitest";
import { deleteUploadedFile, mediaUrlWithVersion } from "./media";

const FILE_MODEL_UID = "plugin::upload.file";

interface HarnessOptions {
  configuredProvider?: string;
  providerThrows?: Error;
  rowDeleteThrows?: Error;
}

function harness(options: HarnessOptions = {}) {
  const { configuredProvider = "local" } = options;
  const providerDeletes: any[] = [];
  const rowDeletes: any[] = [];

  const strapi = {
    config: {
      get: (key: string) =>
        key === "plugin::upload" ? { provider: configuredProvider } : undefined,
    },
    plugin: (name: string) => {
      expect(name).toBe("upload");
      return {
        provider: {
          delete: async (file: any) => {
            providerDeletes.push(file);
            if (options.providerThrows) throw options.providerThrows;
          },
        },
      };
    },
    db: {
      query: (uid: string) => {
        expect(uid).toBe(FILE_MODEL_UID);
        return {
          delete: async (params: any) => {
            rowDeletes.push(params);
            if (options.rowDeleteThrows) throw options.rowDeleteThrows;
          },
        };
      },
    },
  };

  return { strapi, providerDeletes, rowDeletes };
}

describe("mediaUrlWithVersion", () => {
  it("appends v= from an ISO updatedAt", () => {
    const ts = Date.parse("2026-09-10T12:00:00.000Z");
    expect(mediaUrlWithVersion("/uploads/x.png", "2026-09-10T12:00:00.000Z")).toBe(
      `/uploads/x.png?v=${ts}`,
    );
  });

  it("accepts a number or Date", () => {
    expect(mediaUrlWithVersion("/uploads/x.png", 1234)).toBe("/uploads/x.png?v=1234");
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(mediaUrlWithVersion("/uploads/x.png", d)).toBe(`/uploads/x.png?v=${d.getTime()}`);
  });

  it("uses & when the url already has a query string", () => {
    expect(mediaUrlWithVersion("https://cdn/x.png?w=200", 99)).toBe(
      "https://cdn/x.png?w=200&v=99",
    );
  });

  it("returns the url unchanged when the timestamp is missing or unparseable", () => {
    expect(mediaUrlWithVersion("/uploads/x.png", null)).toBe("/uploads/x.png");
    expect(mediaUrlWithVersion("/uploads/x.png", undefined)).toBe("/uploads/x.png");
    expect(mediaUrlWithVersion("/uploads/x.png", "not a date")).toBe("/uploads/x.png");
  });

  it("returns an empty string for an empty url", () => {
    expect(mediaUrlWithVersion("", 123)).toBe("");
    expect(mediaUrlWithVersion(null, 123)).toBe("");
  });
});

describe("deleteUploadedFile", () => {
  it("does nothing at all when there is no file", async () => {
    const h = harness();
    await deleteUploadedFile(h.strapi, null);
    await deleteUploadedFile(h.strapi, undefined);
    await deleteUploadedFile(h.strapi, {});
    expect(h.providerDeletes).toEqual([]);
    expect(h.rowDeletes).toEqual([]);
  });

  it("deletes the original, every generated format, and the media-library row", async () => {
    const h = harness();
    const file = {
      id: 41,
      provider: "local",
      url: "/uploads/ana_pop_portret.jpg",
      formats: {
        thumbnail: { url: "/uploads/thumbnail_ana_pop_portret.jpg" },
        small: { url: "/uploads/small_ana_pop_portret.jpg" },
      },
    };

    await deleteUploadedFile(h.strapi, file);

    expect(h.providerDeletes).toEqual([
      file,
      file.formats.thumbnail,
      file.formats.small,
    ]);
    expect(h.rowDeletes).toEqual([{ where: { id: 41 } }]);
  });

  it("leaves objects on a provider this instance no longer has, but still drops the row", async () => {
    // Mirrors the upload plugin's own guard: a file written by a provider that
    // is no longer configured cannot be reached from here.
    const h = harness({ configuredProvider: "local" });
    await deleteUploadedFile(h.strapi, { id: 7, provider: "aws-s3" });
    expect(h.providerDeletes).toEqual([]);
    expect(h.rowDeletes).toEqual([{ where: { id: 7 } }]);
  });

  it("tolerates a provider failure and still deletes the media-library row", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({ providerThrows: new Error("ENOENT: no such file") });

    await expect(
      deleteUploadedFile(h.strapi, { id: 9, provider: "local" }),
    ).resolves.toBeUndefined();

    expect(h.rowDeletes).toEqual([{ where: { id: 9 } }]);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("propagates a database failure instead of logging it away", async () => {
    // The callers run inside `strapi.db.transaction`. On Postgres a failed
    // statement aborts the transaction, so swallowing this would surface later
    // as "current transaction is aborted" on an unrelated write.
    const dbError = new Error("deadlock detected");
    const h = harness({ rowDeleteThrows: dbError });

    await expect(
      deleteUploadedFile(h.strapi, { id: 9, provider: "local" }),
    ).rejects.toBe(dbError);
  });
});
