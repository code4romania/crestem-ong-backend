import { describe, expect, it } from "vitest";
import { menuItemsSchema } from "./menu-items";

const header = () => menuItemsSchema("header");
const footer = () => menuItemsSchema("footer");

describe("menuItemsSchema — shared rules", () => {
  it("accepts an empty menu", () => {
    expect(header().safeParse([]).success).toBe(true);
  });

  it("rejects a blank label", () => {
    const parsed = header().safeParse([{ label: "   ", pagina: "p1" }]);
    expect(parsed.success).toBe(false);
  });

  it("rejects a hand-written address — a menu points at pages only", () => {
    const parsed = header().safeParse([{ label: "Contact", url: "/contact" }]);
    expect(parsed.success).toBe(false);
  });

  it("rejects an external address", () => {
    const parsed = header().safeParse([
      { label: "Donează", url: "https://example.org/doneaza" },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("rejects a blank page reference", () => {
    const parsed = header().safeParse([{ label: "Despre", pagina: "  " }]);
    expect(parsed.success).toBe(false);
  });

  it("rejects a third level of nesting", () => {
    const parsed = header().safeParse([
      {
        label: "Programe",
        pagina: "p1",
        children: [
          {
            label: "Evaluare ONG",
            pagina: "p2",
            children: [{ label: "Prea adânc", pagina: "p3" }],
          },
        ],
      },
    ]);
    expect(parsed.success).toBe(false);
  });
});

describe("menuItemsSchema — header", () => {
  it("accepts an entry left without a page — the tree saves, the entry does not render", () => {
    const parsed = header().safeParse([{ label: "Programe" }]);
    expect(parsed.success).toBe(true);
  });

  it("accepts a parent that points at a page and carries children", () => {
    const parsed = header().safeParse([
      {
        label: "Programe",
        pagina: "p1",
        children: [{ label: "Evaluare ONG", pagina: "p2" }],
      },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("accepts a parent with children and no page — it only opens a dropdown", () => {
    const parsed = header().safeParse([
      {
        label: "Despre noi",
        children: [
          { label: "Despre noi", pagina: "p1" },
          { label: "Echipă", pagina: "p2" },
        ],
      },
    ]);
    expect(parsed.success).toBe(true);
  });

});

describe("menuItemsSchema — footer", () => {
  it("accepts a column heading that points at nothing", () => {
    const parsed = footer().safeParse([
      { label: "Platformă", children: [{ label: "Despre noi", pagina: "p1" }] },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("rejects a column heading that points at a page", () => {
    const parsed = footer().safeParse([
      {
        label: "Platformă",
        pagina: "p1",
        children: [{ label: "Despre noi", pagina: "p2" }],
      },
    ]);
    expect(parsed.success).toBe(false);
  });

});
