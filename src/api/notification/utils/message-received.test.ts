import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./recipients", () => ({
  activeAmong: vi.fn(),
  fdscAdmins: vi.fn(),
  ongAdmins: vi.fn(),
}));

import { activeAmong, ongAdmins } from "./recipients";
import {
  markConversationNotificationsRead,
  notifyMessageReceived,
  recipientCaughtUp,
} from "./events";
import {
  conversationLink,
  MESSAGE_PREVIEW_LENGTH,
  messagePreview,
  messageReceivedMessage,
} from "./messages";

const notify = vi.fn();
const error = vi.fn();
const findMany = vi.fn();
const updateMany = vi.fn();
const strapi = {
  service: () => ({ notify }),
  log: { error },
  db: { query: () => ({ findMany, updateMany }) },
};

beforeEach(() => {
  vi.clearAllMocks();
  notify.mockResolvedValue(1);
  vi.mocked(ongAdmins).mockResolvedValue([10]);
  vi.mocked(activeAmong).mockImplementation(async (_strapi, ids) => ids);
});

const T1 = "2026-11-09T10:00:00.000Z";
const T2 = "2026-11-09T11:00:00.000Z";

describe("messagePreview", () => {
  it("keeps a short message as is, whitespace collapsed", () => {
    expect(messagePreview("  Bună ziua,\n\nmulțumim   pentru raport.  ")).toBe(
      "Bună ziua, mulțumim pentru raport.",
    );
  });

  it("keeps a message of exactly the limit untouched", () => {
    const text = "a".repeat(MESSAGE_PREVIEW_LENGTH);
    expect(messagePreview(text)).toBe(text);
  });

  it("cuts a long message at the last word boundary, with an ellipsis", () => {
    const text = `${"cuvânt ".repeat(20)}final`;
    const preview = messagePreview(text);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(MESSAGE_PREVIEW_LENGTH + 1);
    expect(preview.slice(0, -1)).toMatch(/cuvânt$/);
  });

  it("cuts a single over-long word mid-word rather than dropping it", () => {
    expect(messagePreview("x".repeat(150), 10)).toBe(`${"x".repeat(10)}…`);
  });

  it("keeps a word ending exactly at the limit", () => {
    expect(messagePreview("abc def ghi", 7)).toBe("abc def…");
  });
});

describe("message-received builder", () => {
  it("links each side to its own messages page, conversation preselected", () => {
    expect(conversationLink("ong", "c1")).toBe("/dashboard/persoane-resursa?conversatie=c1");
    expect(conversationLink("mentor", "c1")).toBe("/dashboard/mesaje?conversatie=c1");
  });

  it("exact copy", () => {
    expect(
      messageReceivedMessage({
        senderName: "Asociația X",
        content: "Salut!",
        recipientSide: "mentor",
        conversationDocumentId: "c1",
      }),
    ).toEqual({
      type: "message-received",
      title: "Mesaj nou de la Asociația X",
      body: "Salut!",
      link: "/dashboard/mesaje?conversatie=c1",
    });
  });
});

describe("recipientCaughtUp", () => {
  it("first message of the conversation: caught up", () => {
    expect(recipientCaughtUp(null, null)).toBe(true);
  });

  it("never opened a conversation that has messages: not caught up", () => {
    expect(recipientCaughtUp(T1, null)).toBe(false);
  });

  it("read after the last message: caught up", () => {
    expect(recipientCaughtUp(T1, T2)).toBe(true);
  });

  it("read at the very moment of the last message (own send): caught up", () => {
    expect(recipientCaughtUp(T1, T1)).toBe(true);
  });

  it("last message after the last read: not caught up", () => {
    expect(recipientCaughtUp(T2, T1)).toBe(false);
  });
});

describe("notifyMessageReceived", () => {
  const conversation = (extra: Record<string, unknown>) => ({
    documentId: "c1",
    ong: { documentId: "o1" },
    mentor: { id: 7 },
    ...extra,
  });

  it("ONG to mentor: notifies the mentor when they had read everything", async () => {
    await notifyMessageReceived(strapi, {
      conversation: conversation({ lastMessageAt: T1, mentorLastReadAt: T2 }),
      recipientSide: "mentor",
      senderName: "Asociația X",
      content: "Salut!",
    });
    expect(activeAmong).toHaveBeenCalledWith(strapi, [7]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipients: [7],
      type: "message-received",
      title: "Mesaj nou de la Asociația X",
      link: "/dashboard/mesaje?conversatie=c1",
    });
  });

  it("mentor to ONG: notifies the ONG's admin", async () => {
    await notifyMessageReceived(strapi, {
      conversation: conversation({ lastMessageAt: null, ongLastReadAt: null }),
      recipientSide: "ong",
      senderName: "Ana Pop",
      content: "Bună!",
    });
    expect(ongAdmins).toHaveBeenCalledWith(strapi, ["o1"]);
    expect(notify.mock.calls[0][0]).toMatchObject({
      recipients: [10],
      title: "Mesaj nou de la Ana Pop",
      link: "/dashboard/persoane-resursa?conversatie=c1",
    });
  });

  it("sends nothing while the conversation is still unread for the recipient", async () => {
    await notifyMessageReceived(strapi, {
      conversation: conversation({ lastMessageAt: T2, mentorLastReadAt: T1 }),
      recipientSide: "mentor",
      senderName: "Asociația X",
      content: "Al doilea mesaj",
    });
    expect(activeAmong).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("reads the recipient's side only: the sender's own read state does not matter", async () => {
    await notifyMessageReceived(strapi, {
      conversation: conversation({
        lastMessageAt: T2,
        ongLastReadAt: T2,
        mentorLastReadAt: T1,
      }),
      recipientSide: "mentor",
      senderName: "Asociația X",
      content: "Încă unul",
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("skips an inactive mentor", async () => {
    vi.mocked(activeAmong).mockResolvedValue([]);
    await notifyMessageReceived(strapi, {
      conversation: conversation({}),
      recipientSide: "mentor",
      senderName: "Asociația X",
      content: "Salut!",
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("never throws when notify fails", async () => {
    notify.mockRejectedValue(new Error("db"));
    await expect(
      notifyMessageReceived(strapi, {
        conversation: conversation({}),
        recipientSide: "ong",
        senderName: "Ana",
        content: "x",
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("markConversationNotificationsRead", () => {
  it("marks the user's unread message notifications of that conversation", async () => {
    findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    updateMany.mockResolvedValue({ count: 2 });
    await markConversationNotificationsRead(strapi, {
      userId: 7,
      side: "mentor",
      conversationDocumentId: "c1",
    });
    expect(findMany).toHaveBeenCalledWith({
      select: ["id"],
      where: {
        recipient: { id: 7 },
        type: "message-received",
        link: "/dashboard/mesaje?conversatie=c1",
        readAt: null,
      },
    });
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: { $in: [1, 2] } });
  });

  it("writes nothing when there is nothing unread", async () => {
    findMany.mockResolvedValue([]);
    await markConversationNotificationsRead(strapi, {
      userId: 10,
      side: "ong",
      conversationDocumentId: "c1",
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("never throws when the database fails", async () => {
    findMany.mockRejectedValue(new Error("db"));
    await expect(
      markConversationNotificationsRead(strapi, {
        userId: 10,
        side: "ong",
        conversationDocumentId: "c1",
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
