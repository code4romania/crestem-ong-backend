/**
 * Strapi implementation of `TransferRepo`. Every write goes through the
 * document service or `strapi.db.query`, so it joins an open
 * `strapi.db.transaction` via the async-local context (see `delete-ong.ts`).
 */
import crypto from "crypto";
import { docRef } from "../../../utils/relations";
import { deleteNgoMemberRole, removeOngMembership } from "../../../utils/membership";
import { createTransferMailer } from "./mailer";
import type {
  Deps,
  OngRecord,
  TransferRecord,
  TransferRepo,
  UserRecord,
} from "./transfer-flow";

const TRANSFER_UID = "api::admin-transfer.admin-transfer";
const USER_UID = "plugin::users-permissions.user";
const ONG_UID = "api::ong.ong";
const ROLE_UID = "plugin::users-permissions.role";

const USER_POPULATE = { role: true, ong: true } as const;
const TRANSFER_POPULATE = {
  ong: true,
  initiator: true,
  previousAdmin: true,
  recipient: { populate: USER_POPULATE },
} as const;

const toUser = (row: any): UserRecord | null =>
  row
    ? {
        id: row.id,
        documentId: row.documentId,
        nume: row.nume,
        email: row.email,
        accountStatus: row.accountStatus,
        role: row.role ? { type: row.role.type } : null,
        ong: ((row.ong ?? []) as any[])
          .filter(Boolean)
          .map((ong) => ({ documentId: ong.documentId })),
      }
    : null;

const toOng = (row: any): OngRecord | null =>
  row ? { documentId: row.documentId, name: row.name, ngoStatus: row.ngoStatus } : null;

const toTransfer = (row: any): TransferRecord | null =>
  row
    ? {
        id: row.id,
        documentId: row.documentId,
        transferStatus: row.transferStatus,
        initiatedBy: row.initiatedBy,
        expiresAt: new Date(row.expiresAt).toISOString(),
        ong: toOng(row.ong),
        initiator: toUser(row.initiator),
        previousAdmin: toUser(row.previousAdmin),
        recipient: toUser(row.recipient),
        recipientEmail: row.recipientEmail,
        recipientName: row.recipientName ?? null,
        createdPendingAccount: Boolean(row.createdPendingAccount),
        tokenCiphertext: row.tokenCiphertext,
      }
    : null;

async function roleId(strapi: any, type: string): Promise<number> {
  const role = await strapi.db.query(ROLE_UID).findOne({ where: { type } });
  if (!role) {
    throw new Error(`Rolul "${type}" nu a fost găsit.`);
  }
  return role.id;
}

export function createTransferRepo(strapi: any): TransferRepo {
  const transfers = () => strapi.documents(TRANSFER_UID);
  const users = () => strapi.documents(USER_UID);

  const findUser = async (documentId: string) =>
    toUser(await users().findOne({ documentId, populate: USER_POPULATE }));

  return {
    transaction: (fn) => strapi.db.transaction(fn),

    async findTransferByHash(tokenHash) {
      return toTransfer(
        await transfers().findFirst({ filters: { tokenHash }, populate: TRANSFER_POPULATE }),
      );
    },

    async findPendingForOng(ongDocumentId) {
      const rows = await transfers().findMany({
        filters: { ong: { documentId: ongDocumentId }, transferStatus: "pending" },
        populate: TRANSFER_POPULATE,
      });
      return rows.map(toTransfer);
    },

    async findPendingForRecipient(userDocumentId) {
      const rows = await transfers().findMany({
        filters: { recipient: { documentId: userDocumentId }, transferStatus: "pending" },
        populate: TRANSFER_POPULATE,
      });
      return rows.map(toTransfer);
    },

    async findPendingForEmail(email) {
      const rows = await transfers().findMany({
        filters: { recipientEmail: { $eqi: email }, transferStatus: "pending" },
        populate: TRANSFER_POPULATE,
      });
      return rows.map(toTransfer);
    },

    async createTransfer(data) {
      const created = await transfers().create({
        data: {
          ong: docRef(data.ongDocumentId),
          transferStatus: "pending",
          initiatedBy: data.initiatedBy,
          initiator: docRef(data.initiatorDocumentId),
          previousAdmin: data.previousAdminDocumentId
            ? docRef(data.previousAdminDocumentId)
            : null,
          recipient: docRef(data.recipientDocumentId),
          recipientEmail: data.recipientEmail,
          recipientName: data.recipientName,
          createdPendingAccount: data.createdPendingAccount,
          tokenHash: data.tokenHash,
          tokenCiphertext: data.tokenCiphertext,
          expiresAt: data.expiresAt.toISOString(),
        },
        populate: TRANSFER_POPULATE,
      });
      return toTransfer(created) as TransferRecord;
    },

    async resolveTransfer(transfer, status, resolvedByDocumentId, at) {
      // Compare-and-set on the row: of two racing requests, only one sees
      // `pending` here; the other gets count 0 once the first commits.
      const { count } = await strapi.db.query(TRANSFER_UID).updateMany({
        where: { id: transfer.id, transferStatus: "pending" },
        data: { transferStatus: status, resolvedAt: at },
      });
      if (!count) return false;
      if (resolvedByDocumentId) {
        await transfers().update({
          documentId: transfer.documentId,
          data: { resolvedBy: docRef(resolvedByDocumentId) },
        });
      }
      return true;
    },

    async findOng(documentId) {
      return toOng(await strapi.documents(ONG_UID).findOne({ documentId }));
    },

    findUser,

    async findUserByEmail(email) {
      return toUser(
        await users().findFirst({
          filters: { email: { $eqi: email } },
          populate: USER_POPULATE,
        }),
      );
    },

    async findOngAdmin(ongDocumentId) {
      return toUser(
        await users().findFirst({
          filters: {
            role: { type: "ngo-admin" },
            ong: { documentId: ongDocumentId },
          },
          populate: USER_POPULATE,
        }),
      );
    },

    async createPendingAccount({ nume, email }) {
      // US-2 BR6: pending, no membership, no admin role until acceptance.
      const created = await strapi
        .plugin("users-permissions")
        .service("user")
        .add({
          nume,
          email,
          password: crypto.randomBytes(32).toString("hex"),
          provider: "local",
          accountStatus: "pending",
          confirmed: true,
          blocked: false,
          role: await roleId(strapi, "individual"),
        });
      return (await findUser(created.documentId)) as UserRecord;
    },

    async activateAccount(user, password) {
      await strapi.plugin("users-permissions").service("user").edit(user.id, {
        password,
        accountStatus: "active",
        resetPasswordToken: null,
      });
    },

    async deleteUser(user) {
      await users().delete({ documentId: user.documentId });
    },

    async makeAdmin(user, ongDocumentId) {
      await users().update({
        documentId: user.documentId,
        data: {
          role: await roleId(strapi, "ngo-admin"),
          ong: [docRef(ongDocumentId)],
        },
      });
      // US-3 step 5: the recipient's member row in the organization goes.
      await deleteNgoMemberRole(strapi, user.documentId, ongDocumentId);
    },

    async removeFromOng(user, ongDocumentId) {
      const result = await removeOngMembership(strapi, user.documentId, ongDocumentId);
      if ("error" in result) {
        // Throwing rolls the whole acceptance back (US-3 AC4).
        throw new Error(result.error);
      }
    },
  };
}

export function createTransferDeps(strapi: any): Deps {
  return {
    repo: createTransferRepo(strapi),
    mailer: createTransferMailer(strapi),
    now: () => new Date(),
    log: (message, error) => strapi.log.error(`${message}: ${String(error)}`),
  };
}
