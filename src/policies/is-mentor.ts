import type { Core } from "@strapi/strapi";

export default (
  policyContext: any,
  config: unknown,
  { strapi }: { strapi: Core.Strapi },
) => {
  const user = policyContext.state?.user;

  if (!user) return false;

  return user.role?.type === "mentor";
};
