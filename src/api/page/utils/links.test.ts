import { describe, expect, it } from "vitest";
import { applyPageLinks, collectChildRequests, collectPageLinkIds } from "./links";

const cta = (pagina: string, href = "") => ({ label: "Află mai multe", href, pagina });

describe("collectPageLinkIds", () => {
  it("finds the page a CTA points at", () => {
    const blocks = [{ id: "a", type: "callout", data: { primaryCta: cta("doc1") } }];
    expect(collectPageLinkIds(blocks)).toEqual(["doc1"]);
  });

  it("finds CTAs nested inside a section", () => {
    const blocks = [
      {
        id: "s",
        type: "section",
        data: {
          blocuri: [{ id: "c", type: "callout", data: { primaryCta: cta("doc2") } }],
        },
      },
    ];
    expect(collectPageLinkIds(blocks)).toEqual(["doc2"]);
  });

  it("finds CTAs inside a card list", () => {
    const blocks = [
      {
        id: "f",
        type: "feature-cards",
        data: { carduri: [cta("doc1"), cta("doc2")] },
      },
    ];
    expect(collectPageLinkIds(blocks)).toEqual(["doc1", "doc2"]);
  });

  it("reports each page once", () => {
    const blocks = [
      { id: "a", type: "callout", data: { primaryCta: cta("doc1"), secondaryCta: cta("doc1") } },
    ];
    expect(collectPageLinkIds(blocks)).toEqual(["doc1"]);
  });

  it("ignores a CTA that carries an external link instead", () => {
    const blocks = [
      { id: "a", type: "callout", data: { primaryCta: cta("", "https://example.org") } },
    ];
    expect(collectPageLinkIds(blocks)).toEqual([]);
  });

  it("ignores a page reference that is not a link", () => {
    const blocks = [{ id: "p", type: "people-grid", data: { pagina: "doc9" } }];
    expect(collectPageLinkIds(blocks)).toEqual([]);
  });
});

describe("applyPageLinks", () => {
  it("rewrites the href to the page's resolved path", () => {
    const blocks = [{ id: "a", type: "callout", data: { primaryCta: cta("doc1") } }];

    const result = applyPageLinks(blocks, { doc1: "/programe/accelerator" }) as any;

    expect(result[0].data.primaryCta.href).toBe("/programe/accelerator");
  });

  it("leaves an external link alone", () => {
    const blocks = [
      { id: "a", type: "callout", data: { primaryCta: cta("", "https://example.org") } },
    ];

    const result = applyPageLinks(blocks, {}) as any;

    expect(result[0].data.primaryCta.href).toBe("https://example.org");
  });

  it("clears the href when the target page is gone", () => {
    const blocks = [
      { id: "a", type: "callout", data: { primaryCta: cta("doc1", "/stale") } },
    ];

    const result = applyPageLinks(blocks, {}) as any;

    expect(result[0].data.primaryCta.href).toBe("");
  });

  it("rewrites CTAs nested inside a section", () => {
    const blocks = [
      {
        id: "s",
        type: "section",
        data: { blocuri: [{ id: "c", type: "callout", data: { primaryCta: cta("doc1") } }] },
      },
    ];

    const result = applyPageLinks(blocks, { doc1: "/contact" }) as any;

    expect(result[0].data.blocuri[0].data.primaryCta.href).toBe("/contact");
  });

  it("does not touch the stored blocks", () => {
    const blocks = [{ id: "a", type: "callout", data: { primaryCta: cta("doc1") } }];

    applyPageLinks(blocks, { doc1: "/contact" });

    expect((blocks[0].data.primaryCta as any).href).toBe("");
  });
})

describe("collectChildRequests", () => {
  it("lists the page a link asks to adopt", () => {
    const blocks = [
      { id: "a", type: "callout", data: { primaryCta: { ...cta("doc1"), subPagina: true } } },
    ];
    expect(collectChildRequests(blocks)).toEqual(["doc1"]);
  });

  it("ignores a link that does not ask", () => {
    const blocks = [{ id: "a", type: "callout", data: { primaryCta: cta("doc1") } }];
    expect(collectChildRequests(blocks)).toEqual([]);
  });

  it("ignores an external link that carries the flag", () => {
    const blocks = [
      {
        id: "a",
        type: "callout",
        data: { primaryCta: { ...cta("", "https://example.org"), subPagina: true } },
      },
    ];
    expect(collectChildRequests(blocks)).toEqual([]);
  });

  it("reports each page once", () => {
    const blocks = [
      {
        id: "a",
        type: "callout",
        data: {
          primaryCta: { ...cta("doc1"), subPagina: true },
          secondaryCta: { ...cta("doc1"), subPagina: true },
        },
      },
    ];
    expect(collectChildRequests(blocks)).toEqual(["doc1"]);
  });

  it("finds a request nested inside a section", () => {
    const blocks = [
      {
        id: "s",
        type: "section",
        data: {
          blocuri: [
            { id: "c", type: "callout", data: { primaryCta: { ...cta("doc2"), subPagina: true } } },
          ],
        },
      },
    ];
    expect(collectChildRequests(blocks)).toEqual(["doc2"]);
  });
});
