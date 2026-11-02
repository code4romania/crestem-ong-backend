/** Strapi implementation of `TransferNotifier` (in-app notifications). */
import { adminTransferMessage } from "../../notification/utils/messages";
import type { TransferNotifier } from "./transfer-flow";

export function createTransferNotifier(strapi: any): TransferNotifier {
  return {
    async initiatedByFdsc({ previousAdminId, recipientEmail }) {
      await strapi.service("api::notification.notification").notify({
        recipients: [previousAdminId],
        ...adminTransferMessage({ recipientEmail }),
      });
    },
  };
}
