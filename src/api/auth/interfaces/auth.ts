/**
 * Interfaces for the `auth` API.
 */

import { z } from "zod";
import {
  registerNgoSchema,
  registerIndividualSchema,
  registerMentorSchema,
  activateMentorSchema,
  refreshTokenSchema,
} from "../validation/auth";

export type NgoCreatePayload = z.infer<typeof registerNgoSchema>;
export type IndividualCreatePayload = z.infer<typeof registerIndividualSchema>;
export type MentorCreatePayload = z.infer<typeof registerMentorSchema>;
export type MentorActivatePayload = z.infer<typeof activateMentorSchema>;
export type RefreshTokenPayload = z.infer<typeof refreshTokenSchema>;

export type MentorCreateResult = {
  id: number;
  status: string;
  emailSent: boolean;
};
