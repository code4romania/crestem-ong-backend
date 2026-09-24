/**
 * Transfer rol Admin ONG — HTTP layer. The rules live in
 * `../services/transfer-flow.ts`; this file resolves who is asking, for which
 * organization, and maps `{ error }` results onto 400 answers.
 */
import { Context } from "koa";
import { requireOng } from "../../../utils/ong-scope";
import { RefreshTokenService } from "../../refresh-token/services/refresh-token";
import { createTransferDeps } from "../services/repository";
import {
  acceptNewAccount,
  acceptTransfer,
  cancelTransfer,
  createTransfer,
  declineNewAccount,
  declineTransfer,
  findIncomingTransfer,
  findPendingForOng,
  previewTransfer,
  resendTransfer,
  toTransferView,
  type TransferRecord,
  type TransferTarget,
} from "../services/transfer-flow";
import { canNgoAdminManage } from "../utils/state";
import { TRANSFER_MESSAGES } from "../utils/messages";
import {
  acceptNewAccountSchema,
  createTransferSchema,
  fdscCreateTransferSchema,
  tokenSchema,
} from "../validation/admin-transfer";

const USER_UID = "plugin::users-permissions.user";

const deps = () => createTransferDeps(strapi);

const emailSentMessage = (emailSent: boolean, sent: string) =>
  emailSent
    ? sent
    : "Transferul a fost creat, dar emailul nu a putut fi trimis. Folosește „Retrimite”.";

async function passwordMatches(userId: number, password: string): Promise<boolean> {
  const user = await strapi.db.query(USER_UID).findOne({ where: { id: userId } });
  if (!user) return false;
  return strapi
    .plugin("users-permissions")
    .service("user")
    .validatePassword(password, user.password);
}

/** The ONG admin's pending transfer, only when `:documentId` names it. */
async function ownPendingTransfer(
  ctx: Context,
): Promise<{ transfer: TransferRecord } | { status: 400 | 403; message: string }> {
  const scope = await requireOng(strapi, ctx);
  if ("error" in scope) return { status: 400, message: scope.error };
  const transfer = await findPendingForOng(deps(), scope.ong.documentId);
  if (!transfer || transfer.documentId !== ctx.params.documentId) {
    return { status: 400, message: TRANSFER_MESSAGES.NO_PENDING };
  }
  if (!canNgoAdminManage(transfer, ctx.state.user.documentId)) {
    return { status: 403, message: TRANSFER_MESSAGES.NOT_ALLOWED };
  }
  return { transfer };
}

async function loadOng(documentId: string) {
  return deps().repo.findOng(documentId);
}

export default {
  // ---- ONG admin (US-1, US-2, US-4) ----

  async current(ctx: Context) {
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) return ctx.badRequest(scope.error);
    const transfer = await findPendingForOng(deps(), scope.ong.documentId);
    return {
      data: transfer
        ? toTransferView(transfer, canNgoAdminManage(transfer, ctx.state.user.documentId))
        : null,
    };
  },

  async create(ctx: Context) {
    const parsed = createTransferSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    // US-1 A1: a wrong password stops everything before any other check.
    if (!(await passwordMatches(ctx.state.user.id, parsed.data.password))) {
      return ctx.badRequest(TRANSFER_MESSAGES.WRONG_PASSWORD);
    }
    const scope = await requireOng(strapi, ctx);
    if ("error" in scope) return ctx.badRequest(scope.error);
    const ong = await loadOng(scope.ong.documentId);
    if (!ong) return ctx.badRequest(TRANSFER_MESSAGES.ONG_NOT_FOUND);

    const { password: _password, ...target } = parsed.data;
    const result = await createTransfer(deps(), {
      ong,
      initiator: { documentId: ctx.state.user.documentId, nume: scope.user.nume },
      initiatedBy: "ngo-admin",
      // Validated above; `strict: false` only widens zod's inferred type.
      target: target as TransferTarget,
    });
    if ("error" in result) return ctx.badRequest(result.error);
    return {
      data: toTransferView(result.data.transfer, true),
      emailSent: result.data.emailSent,
      message: emailSentMessage(result.data.emailSent, "Propunerea de transfer a fost trimisă."),
    };
  },

  async cancel(ctx: Context) {
    const found = await ownPendingTransfer(ctx);
    if ("message" in found) {
      return found.status === 403 ? ctx.forbidden(found.message) : ctx.badRequest(found.message);
    }
    const result = await cancelTransfer(deps(), found.transfer, ctx.state.user.documentId, false);
    if ("error" in result) return ctx.badRequest(result.error);
    return { message: "Transferul a fost anulat." };
  },

  async resend(ctx: Context) {
    const found = await ownPendingTransfer(ctx);
    if ("message" in found) {
      return found.status === 403 ? ctx.forbidden(found.message) : ctx.badRequest(found.message);
    }
    const result = await resendTransfer(deps(), found.transfer);
    if ("error" in result) return ctx.badRequest(result.error);
    return {
      emailSent: result.data.emailSent,
      message: result.data.emailSent
        ? "Emailul a fost retrimis."
        : "Emailul nu a putut fi trimis. Încearcă din nou mai târziu.",
    };
  },

  // ---- FDSC Admin (US-5) ----

  async fdscDetail(ctx: Context) {
    const ong = await loadOng(ctx.params.documentId);
    if (!ong) return ctx.badRequest(TRANSFER_MESSAGES.ONG_NOT_FOUND);
    const transfer = await findPendingForOng(deps(), ong.documentId);
    const members: any[] = await strapi.documents(USER_UID).findMany({
      filters: { ong: { documentId: ong.documentId }, role: { type: "ngo-member" } },
      sort: { nume: "asc" },
    });
    return {
      data: {
        transfer: transfer ? toTransferView(transfer, true) : null,
        ongStatus: ong.ngoStatus,
        members: members.map((member) => ({
          documentId: member.documentId,
          nume: member.nume,
          email: member.email,
          accountStatus: member.accountStatus,
        })),
      },
    };
  },

  async fdscCreate(ctx: Context) {
    const parsed = fdscCreateTransferSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const ong = await loadOng(ctx.params.documentId);
    if (!ong) return ctx.badRequest(TRANSFER_MESSAGES.ONG_NOT_FOUND);
    const result = await createTransfer(deps(), {
      ong,
      initiator: { documentId: ctx.state.user.documentId, nume: ctx.state.user.nume },
      initiatedBy: "fdsc",
      target: parsed.data as TransferTarget,
    });
    if ("error" in result) return ctx.badRequest(result.error);
    return {
      data: toTransferView(result.data.transfer, true),
      emailSent: result.data.emailSent,
      message: emailSentMessage(result.data.emailSent, "Propunerea de transfer a fost trimisă."),
    };
  },

  async fdscCancel(ctx: Context) {
    const transfer = await findPendingForOng(deps(), ctx.params.documentId);
    if (!transfer) return ctx.badRequest(TRANSFER_MESSAGES.NO_PENDING);
    const result = await cancelTransfer(deps(), transfer, ctx.state.user.documentId, true);
    if ("error" in result) return ctx.badRequest(result.error);
    return { message: "Transferul a fost anulat." };
  },

  async fdscResend(ctx: Context) {
    const transfer = await findPendingForOng(deps(), ctx.params.documentId);
    if (!transfer) return ctx.badRequest(TRANSFER_MESSAGES.NO_PENDING);
    const result = await resendTransfer(deps(), transfer);
    if ("error" in result) return ctx.badRequest(result.error);
    return {
      emailSent: result.data.emailSent,
      message: result.data.emailSent
        ? "Emailul a fost retrimis."
        : "Emailul nu a putut fi trimis. Încearcă din nou mai târziu.",
    };
  },

  // ---- Recipient (US-3) ----

  /** The signed-in member's pending proposal, shown on their profile (D11). */
  async incoming(ctx: Context) {
    return { data: await findIncomingTransfer(deps(), ctx.state.user.documentId) };
  },

  async preview(ctx: Context) {
    const parsed = tokenSchema.safeParse(ctx.request.body);
    if (!parsed.success) return { data: { valid: false, reason: "invalid" } };
    return { data: await previewTransfer(deps(), parsed.data.token) };
  },

  async accept(ctx: Context) {
    const parsed = tokenSchema.safeParse(ctx.request.body);
    if (!parsed.success) return ctx.badRequest(TRANSFER_MESSAGES.INVALID_LINK);
    const result = await acceptTransfer(deps(), parsed.data.token, ctx.state.user.documentId);
    if ("error" in result) return ctx.badRequest(result.error);
    return { message: "Ai preluat rolul de administrator al organizației." };
  },

  async decline(ctx: Context) {
    const parsed = tokenSchema.safeParse(ctx.request.body);
    if (!parsed.success) return ctx.badRequest(TRANSFER_MESSAGES.INVALID_LINK);
    const result = await declineTransfer(deps(), parsed.data.token, ctx.state.user.documentId);
    if ("error" in result) return ctx.badRequest(result.error);
    return { message: "Ai refuzat propunerea." };
  },

  async acceptNew(ctx: Context) {
    const parsed = await acceptNewAccountSchema.safeParseAsync(ctx.request.body);
    if (!parsed.success) {
      return ctx.badRequest("Date invalide: ", parsed.error.flatten());
    }
    const result = await acceptNewAccount(deps(), parsed.data.token, parsed.data.password);
    if ("error" in result) return ctx.badRequest(result.error);

    // US-3 step 8: the new admin lands in the ONG dashboard already signed in.
    const userId = result.data.recipientId;
    const refreshToken = await (
      strapi.service("api::refresh-token.refresh-token") as RefreshTokenService
    ).issue(userId, ctx.request.header["user-agent"]);
    const jwt = strapi.plugin("users-permissions").service("jwt").issue({ id: userId });
    return {
      jwt,
      refreshToken,
      message: "Contul a fost activat și ai preluat rolul de administrator.",
    };
  },

  async declineNew(ctx: Context) {
    const parsed = tokenSchema.safeParse(ctx.request.body);
    if (!parsed.success) return ctx.badRequest(TRANSFER_MESSAGES.INVALID_LINK);
    const result = await declineNewAccount(deps(), parsed.data.token);
    if ("error" in result) return ctx.badRequest(result.error);
    return { message: "Ai refuzat propunerea." };
  },
};
