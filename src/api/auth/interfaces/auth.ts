/**
 * Interfaces for the `auth` API.
 */

import { z } from "zod";
import {
  registerNgoSchema,
  registerIndividualSchema,
  registerMentorSchema,
  registerMemberSchema,
  registerStaffSchema,
  activateAccountSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validation/auth";

export type NgoCreatePayload = z.infer<typeof registerNgoSchema>;
export type IndividualCreatePayload = z.infer<typeof registerIndividualSchema>;
export type MentorCreatePayload = z.infer<typeof registerMentorSchema>;
export type MemberCreatePayload = z.infer<typeof registerMemberSchema>;
export type StaffCreatePayload = z.infer<typeof registerStaffSchema>;
export type ActivateAccountPayload = z.infer<typeof activateAccountSchema>;
export type RefreshTokenPayload = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;

export type InviteCreateResult = {
  id: number;
  emailSent: boolean;
  activationLink?: string;
};

export type InviteResendResult = {
  emailSent: boolean;
  activationLink?: string;
};
