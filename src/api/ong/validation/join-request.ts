/**
 * Validation schema for `POST /api/ongs/join-requests/:documentId/accept`.
 *
 * The requester never proposes a role — the NGO admin sets it when accepting.
 */

import { z } from "zod";

import { ngoRoleSchema } from "../../../utils/ngo-role";

export const acceptJoinRequestSchema = z.object({
  rol: ngoRoleSchema,
});
