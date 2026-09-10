import { describe, expect, it } from "vitest";
import { assetCard, assetDetail } from "./view";

const row = {
  documentId: "a1",
  titlu: "Logo FDSC",
  descriere: "pe fundal transparent",
  createdAt: "2026-09-01T10:00:00.000Z",
  fisier: {
    id: 42,
    url: "/uploads/logo_fdsc.png",
    name: "logo_fdsc.png",
    mime: "image/png",
    ext: ".png",
    size: 12.34,
    width: 800,
    height: 240,
    alternativeText: "Sigla FDSC",
  },
  etichete: [
    { id: 1, documentId: "t1", nume: "logo", slug: "logo" },
    { id: 2, documentId: "t2", nume: "brand", slug: "brand" },
  ],
  createdBy: { firstname: "Ana", lastname: "Pop", email: "ana@fdsc.ro" },
};

describe("assetCard", () => {
  it("projects the card fields", () => {
    expect(assetCard({ ...row, utilizariCount: 3 })).toEqual({
      documentId: "a1",
      titlu: "Logo FDSC",
      fisier: {
        id: 42,
        url: "/uploads/logo_fdsc.png",
        name: "logo_fdsc.png",
        mime: "image/png",
        ext: ".png",
        size: 12.34,
        alternativeText: "Sigla FDSC",
        width: 800,
        height: 240,
      },
      tip: "image",
      etichete: [
        { id: 1, documentId: "t1", nume: "logo", slug: "logo" },
        { id: 2, documentId: "t2", nume: "brand", slug: "brand" },
      ],
      utilizariCount: 3,
    });
  });

  it("defaults utilizariCount to 0 and tolerates no tags", () => {
    const card = assetCard({ ...row, etichete: undefined });
    expect(card.utilizariCount).toBe(0);
    expect(card.etichete).toEqual([]);
  });

  it("cache-busts the file url with the file's updatedAt", () => {
    const ts = Date.parse("2026-09-10T12:00:00.000Z");
    const card = assetCard({
      ...row,
      fisier: { ...row.fisier, updatedAt: "2026-09-10T12:00:00.000Z" },
    });
    expect(card.fisier.url).toBe(`/uploads/logo_fdsc.png?v=${ts}`);
  });
});

describe("assetDetail", () => {
  it("adds descriere, alt text, uploader and usage", () => {
    const usage = [{ documentId: "p1", titlu: "Despre noi", cale: "/despre-noi" }];
    const detail = assetDetail(row, usage);
    expect(detail.descriere).toBe("pe fundal transparent");
    expect(detail.altText).toBe("Sigla FDSC");
    expect(detail.adaugatDe).toBe("Ana Pop");
    expect(detail.utilizari).toEqual(usage);
    expect(detail.utilizariCount).toBe(1);
  });

  it("falls back to '—' when the uploader has no name", () => {
    expect(assetDetail({ ...row, createdBy: {} }, []).adaugatDe).toBe("—");
    expect(assetDetail({ ...row, createdBy: null }, []).adaugatDe).toBe("—");
  });
});
