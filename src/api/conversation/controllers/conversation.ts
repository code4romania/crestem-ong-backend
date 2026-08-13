import { Context } from "koa";
import { requireOng } from "../../../utils/ong-scope";
import { syncConversationsForOng } from "../utils/sync";
import { sendMessageSchema } from "../validation/send-message";

const mentorView = (mentor: any) =>
  mentor
    ? {
        documentId: mentor.documentId,
        nume: mentor.nume,
        mentorOrganization: mentor.mentorOrganization ?? null,
        avatar: mentor.avatar
          ? {
              documentId: mentor.avatar.documentId,
              name: mentor.avatar.name,
              url: mentor.avatar.url,
            }
          : null,
      }
    : null;

const ongView = (ong: any) =>
  ong
    ? {
        documentId: ong.documentId,
        name: ong.name,
        logo: ong.logo
          ? {
              documentId: ong.logo.documentId,
              name: ong.logo.name,
              url: ong.logo.url,
            }
          : null,
      }
    : null;

const messageView = (message: any, currentUserDocumentId: string) => ({
  documentId: message.documentId,
  content: message.content,
  createdAt: message.createdAt,
  fromMe: message.sender?.documentId === currentUserDocumentId,
});

const findOwnedConversation = async (
  strapi: any,
  documentId: string,
  ongDocumentId: string,
) => {
  const conversation = await strapi
    .documents("api::conversation.conversation")
    .findOne({ documentId, populate: { ong: true } });
  if (!conversation || conversation.ong?.documentId !== ongDocumentId) {
    return null;
  }
  return conversation;
};

const findMentorConversation = async (
  strapi: any,
  documentId: string,
  mentorDocumentId: string,
) => {
  const conversation = await strapi
    .documents("api::conversation.conversation")
    .findOne({ documentId, populate: { mentor: true } });
  if (!conversation || conversation.mentor?.documentId !== mentorDocumentId) {
    return null;
  }
  return conversation;
};

export default {
  async list(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const ong = scope.ong;

    await syncConversationsForOng(strapi, ong);

    const conversations = await strapi
      .documents("api::conversation.conversation")
      .findMany({
        filters: { ong: { documentId: ong.documentId } },
        populate: { mentor: { populate: { avatar: true } } },
      });

    const conversationIds = (conversations as any[]).map((c) => c.documentId);
    const lastMessageByConversation = new Map<string, any>();
    if (conversationIds.length > 0) {
      const messages = await strapi.documents("api::message.message").findMany({
        filters: { conversation: { documentId: { $in: conversationIds } } },
        sort: { createdAt: "desc" },
        populate: { conversation: true },
      });
      for (const message of messages as any[]) {
        const convId = message.conversation?.documentId;
        if (convId && !lastMessageByConversation.has(convId)) {
          lastMessageByConversation.set(convId, message);
        }
      }
    }

    const data = (conversations as any[])
      .map((conversation) => {
        const lastMessage =
          lastMessageByConversation.get(conversation.documentId) ?? null;
        const unread =
          Boolean(conversation.lastMessageAt) &&
          (!conversation.ongLastReadAt ||
            new Date(conversation.lastMessageAt) >
              new Date(conversation.ongLastReadAt));
        return {
          documentId: conversation.documentId,
          mentor: mentorView(conversation.mentor),
          lastMessage: lastMessage
            ? { content: lastMessage.content, createdAt: lastMessage.createdAt }
            : null,
          lastMessageAt: conversation.lastMessageAt ?? null,
          unread,
        };
      })
      .sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });

    return { data };
  },

  async messages(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const conversation = await findOwnedConversation(
      strapi,
      ctx.params.documentId,
      scope.ong.documentId,
    );
    if (!conversation) {
      return ctx.badRequest("Conversația nu există");
    }

    const messages = await strapi.documents("api::message.message").findMany({
      filters: { conversation: { documentId: conversation.documentId } },
      sort: { createdAt: "asc" },
      populate: { sender: true },
    });

    await strapi.documents("api::conversation.conversation").update({
      documentId: conversation.documentId,
      data: { ongLastReadAt: new Date().toISOString() },
    });

    return {
      data: (messages as any[]).map((message) =>
        messageView(message, ctx.state.user.documentId),
      ),
    };
  },

  async sendMessage(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const parsed = sendMessageSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) {
      return ctx.badRequest(scope.error);
    }
    const conversation = await findOwnedConversation(
      strapi,
      ctx.params.documentId,
      scope.ong.documentId,
    );
    if (!conversation) {
      return ctx.badRequest("Conversația nu există");
    }

    const now = new Date().toISOString();
    const message = await strapi.documents("api::message.message").create({
      data: {
        conversation: conversation.documentId,
        sender: ctx.state.user.documentId,
        content: parsed.data.content,
      },
      populate: { sender: true },
    });
    await strapi.documents("api::conversation.conversation").update({
      documentId: conversation.documentId,
      data: { lastMessageAt: now, ongLastReadAt: now },
    });

    return { data: messageView(message, ctx.state.user.documentId) };
  },

  async listForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const mentorDocumentId = ctx.state.user.documentId;

    const conversations = await strapi
      .documents("api::conversation.conversation")
      .findMany({
        filters: { mentor: { documentId: mentorDocumentId } },
        populate: { ong: { populate: { logo: true } } },
      });

    const conversationIds = (conversations as any[]).map((c) => c.documentId);
    const lastMessageByConversation = new Map<string, any>();
    if (conversationIds.length > 0) {
      const messages = await strapi.documents("api::message.message").findMany({
        filters: { conversation: { documentId: { $in: conversationIds } } },
        sort: { createdAt: "desc" },
        populate: { conversation: true },
      });
      for (const message of messages as any[]) {
        const convId = message.conversation?.documentId;
        if (convId && !lastMessageByConversation.has(convId)) {
          lastMessageByConversation.set(convId, message);
        }
      }
    }

    const data = (conversations as any[])
      .map((conversation) => {
        const lastMessage =
          lastMessageByConversation.get(conversation.documentId) ?? null;
        const unread =
          Boolean(conversation.lastMessageAt) &&
          (!conversation.mentorLastReadAt ||
            new Date(conversation.lastMessageAt) >
              new Date(conversation.mentorLastReadAt));
        return {
          documentId: conversation.documentId,
          ong: ongView(conversation.ong),
          lastMessage: lastMessage
            ? { content: lastMessage.content, createdAt: lastMessage.createdAt }
            : null,
          lastMessageAt: conversation.lastMessageAt ?? null,
          unread,
        };
      })
      .sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });

    return { data };
  },

  async messagesForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const conversation = await findMentorConversation(
      strapi,
      ctx.params.documentId,
      ctx.state.user.documentId,
    );
    if (!conversation) {
      return ctx.badRequest("Conversația nu există");
    }

    const messages = await strapi.documents("api::message.message").findMany({
      filters: { conversation: { documentId: conversation.documentId } },
      sort: { createdAt: "asc" },
      populate: { sender: true },
    });

    await strapi.documents("api::conversation.conversation").update({
      documentId: conversation.documentId,
      data: { mentorLastReadAt: new Date().toISOString() },
    });

    return {
      data: (messages as any[]).map((message) =>
        messageView(message, ctx.state.user.documentId),
      ),
    };
  },

  async sendMessageForMentor(ctx: Context) {
    if (!ctx.state.user) {
      return ctx.unauthorized();
    }
    const parsed = sendMessageSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const conversation = await findMentorConversation(
      strapi,
      ctx.params.documentId,
      ctx.state.user.documentId,
    );
    if (!conversation) {
      return ctx.badRequest("Conversația nu există");
    }

    const now = new Date().toISOString();
    const message = await strapi.documents("api::message.message").create({
      data: {
        conversation: conversation.documentId,
        sender: ctx.state.user.documentId,
        content: parsed.data.content,
      },
      populate: { sender: true },
    });
    await strapi.documents("api::conversation.conversation").update({
      documentId: conversation.documentId,
      data: { lastMessageAt: now, mentorLastReadAt: now },
    });

    return { data: messageView(message, ctx.state.user.documentId) };
  },
};
