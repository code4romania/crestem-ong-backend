/**
 * `firstLoginAt` is the only durable marker that an account has ever reached
 * the app. It is written once, on the login that sets it, and the login
 * response carries `isFirstLogin` so the frontend can greet the account before
 * the marker stops being distinguishable from `lastLoginAt`.
 */

export type LoginTimestampSource = { firstLoginAt?: Date | string | null } | null;

export type LoginTimestamps = {
  isFirstLogin: boolean;
  data: { lastLoginAt: Date; firstLoginAt?: Date };
};

export function resolveLoginTimestamps(
  user: LoginTimestampSource,
  now: Date,
): LoginTimestamps {
  const isFirstLogin = !user?.firstLoginAt;

  return {
    isFirstLogin,
    data: isFirstLogin ? { lastLoginAt: now, firstLoginAt: now } : { lastLoginAt: now },
  };
}
