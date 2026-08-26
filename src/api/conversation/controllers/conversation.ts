import { Context } from "koa";
import { isAnonymized } from "../../../utils/anonymize";
import { getOngAdminNames, requireOng } from "../../../utils/ong-scope";
import {
  pairKey,
  syncConversationsForMentor,
  syncConversationsForOng,
} from "../utils/sync";
import { sendMessageSchema } from "../validation/send-message";

/**
 * A mentor who deleted their account keeps the conversation (BR-34): the
 * organization still reads the whole history, under the `Anonim <documentId>`
 * name (BR-27). `isDeleted` is what greys the thread out and disables the
 * composer — `sendMessage` refuses the write regardless.
 */
const mentorView = (mentor: any) => {
  if (!mentor) return null;
  const deleted = isAnonymized(mentor);
  return {
    documentId: mentor.documentId,
    nume: mentor.nume,
    mentorOrganization: deleted ? null : (mentor.mentorOrganization ?? null),
    avatar:
      !deleted && mentor.avatar
        ? {
            documentId: mentor.avatar.documentId,
            name: mentor.avatar.name,
            url: mentor.avatar.url,
          }
        : null,
    isDeleted: deleted,
  };
};

const ongView = (ong: any, adminNume?: string | null) =>
  ong
    ? {
        documentId: ong.documentId,
        name: ong.name,
        admin: adminNume ? { nume: adminNume } : null,
        logo: ong.logo
          ? {
              documentId: ong.logo.documentId,
              name: ong.logo.name,
              url: ong.logo.url,
            }
          : null,
      }
    : null;

const programView = (program: any) =>
  program ? { documentId: program.documentId, name: program.name } : null;

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
    .findOne({ documentId, populate: { ong: true, mentor: true } });
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

    const validPairs = await syncConversationsForOng(strapi, ong);

    const conversations = (
      await strapi.documents("api::conversation.conversation").findMany({
        filters: { ong: { documentId: ong.documentId } },
        populate: { mentor: { populate: { avatar: true } }, program: true },
      })
    ).filter((conversation: any) => {
      const programId = conversation.program?.documentId;
      const mentorId = conversation.mentor?.documentId;
      return Boolean(programId && mentorId && validPairs.has(pairKey(programId, mentorId)));
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
          program: programView(conversation.program),
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
    // The thread stays readable after the mentor deletes their account
    // (BR-34), but it is archived — nobody is left to answer. The frontend
    // greys it out and disables the composer; this is the enforcement.
    if (isAnonymized(conversation.mentor)) {
      return ctx.badRequest(
        "Persoana resursă și-a șters contul. Conversația este arhivată.",
      );
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

    const validPairs = await syncConversationsForMentor(strapi, ctx.state.user);

    const conversations = (
      await strapi.documents("api::conversation.conversation").findMany({
        filters: { mentor: { documentId: mentorDocumentId } },
        populate: { ong: { populate: { logo: true } }, program: true },
      })
    ).filter((conversation: any) => {
      const programId = conversation.program?.documentId;
      const ongId = conversation.ong?.documentId;
      return Boolean(programId && ongId && validPairs.has(pairKey(programId, ongId)));
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

    const ongDocumentIds = Array.from(
      new Set(
        (conversations as any[]).map((c) => c.ong?.documentId).filter(Boolean),
      ),
    );
    const adminNameByOng = await getOngAdminNames(strapi, ongDocumentIds);

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
          ong: ongView(
            conversation.ong,
            adminNameByOng.get(conversation.ong?.documentId) ?? null,
          ),
          program: programView(conversation.program),
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
