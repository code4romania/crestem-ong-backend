/**
 * The member's function inside an organization (președinte, coordonator, voluntar...).
 *
 * Free text, set only by the NGO admin. Shared by the two entry points into a
 * membership: creating a member account and accepting an affiliation request.
 */

import { z } from "zod";

export const ngoRoleSchema = z
  .string({ message: "Rolul în organizație este obligatoriu" })
  .trim()
  .min(2, "Rolul în organizație este obligatoriu")
  .max(100, "Rolul în organizație este prea lung");
