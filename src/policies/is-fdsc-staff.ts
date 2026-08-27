import type { Core } from "@strapi/strapi";
import { isFdscStaff } from "../utils/fdsc-staff";

export default (
  policyContext: any,
  config: unknown,
  { strapi }: { strapi: Core.Strapi },
) => {
  const user = policyContext.state?.user;

  if (!user) return false;

  return isFdscStaff(user.role?.type);
};
