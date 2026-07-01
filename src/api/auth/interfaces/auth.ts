/**
 * Interfaces for the `auth` API.
 */

import { z } from "zod";
import {
  registerNgoSchema,
  registerIndividualSchema,
} from "../validation/auth";

export type NgoCreatePayload = z.infer<typeof registerNgoSchema>;
export type IndividualCreatePayload = z.infer<typeof registerIndividualSchema>;
