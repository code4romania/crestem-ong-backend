import { describe, expect, it } from "vitest";
import { menuItemsSchema } from "./menu-items";

const header = () => menuItemsSchema("header");
const footer = () => menuItemsSchema("footer");

describe("menuItemsSchema — shared rules", () => {
  it("accepts an empty menu", () => {
    expect(header().safeParse([]).success).toBe(true);
  });

  it("rejects a blank label", () => {
    const parsed = header().safeParse([{ label: "   ", url: "/acasa" }]);
    expect(parsed.success).toBe(false);
  });

  it("rejects a url that is neither a path nor an absolute address", () => {
    const parsed = header().safeParse([{ label: "Acasă", url: "acasa" }]);
    expect(parsed.success).toBe(false);
  });

  it("accepts an absolute external url", () => {
    const parsed = header().safeParse([
      { label: "Donează", url: "https://example.org/doneaza" },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("rejects a third level of nesting", () => {
    const parsed = header().safeParse([
      {
        label: "Programe",
        url: "/programe",
        children: [
          {
            label: "Evaluare ONG",
            url: "/evaluare-ong",
            children: [{ label: "Prea adânc", url: "/prea-adanc" }],
          },
        ],
      },
    ]);
    expect(parsed.success).toBe(false);
  });
});

describe("menuItemsSchema — header", () => {
  it("accepts a parent that links and carries children", () => {
    const parsed = header().safeParse([
      {
        label: "Programe",
        url: "/programe",
        children: [{ label: "Evaluare ONG", url: "/evaluare-ong" }],
      },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("accepts a parent with children and no url — it only opens a dropdown", () => {
    const parsed = header().safeParse([
      {
        label: "Despre noi",
        children: [
          { label: "Despre noi", url: "/despre" },
          { label: "Echipă", url: "/echipa" },
        ],
      },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("rejects an item with neither children nor a url", () => {
    const parsed = header().safeParse([{ label: "Programe" }]);
    expect(parsed.success).toBe(false);
  });

  it("rejects an item whose only child list is empty and has no url", () => {
    const parsed = header().safeParse([{ label: "Programe", children: [] }]);
    expect(parsed.success).toBe(false);
  });

  it("rejects a child without a url", () => {
    const parsed = header().safeParse([
      { label: "Programe", url: "/programe", children: [{ label: "Evaluare ONG" }] },
    ]);
    expect(parsed.success).toBe(false);
  });
});

describe("menuItemsSchema — footer", () => {
  it("accepts a column heading that carries no url", () => {
    const parsed = footer().safeParse([
      {
        label: "Platformă",
        children: [{ label: "Despre noi", url: "/despre" }],
      },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("rejects a column heading that carries a url", () => {
    const parsed = footer().safeParse([
      {
        label: "Platformă",
        url: "/platforma",
        children: [{ label: "Despre noi", url: "/despre" }],
      },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("rejects a column link without a url", () => {
    const parsed = footer().safeParse([
      { label: "Platformă", children: [{ label: "Despre noi" }] },
    ]);
    expect(parsed.success).toBe(false);
  });
});
