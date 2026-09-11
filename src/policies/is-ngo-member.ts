import type { Core } from "@strapi/strapi";

export default (
  policyContext: any,
  config: unknown,
  { strapi }: { strapi: Core.Strapi },
) => {
  const user = policyContext.state?.user;

  if (!user) return false;

  // An ngo-admin can also respond to their own ONG's evaluation — see
  // resolveMembers in api/report/utils/members.ts, which allows the same pair.
  return user.role?.type === "ngo-member" || user.role?.type === "ngo-admin";
};
