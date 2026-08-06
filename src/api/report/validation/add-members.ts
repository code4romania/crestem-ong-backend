import { z } from "zod";

export const addMembersSchema = z.object({
  members: z
    .array(z.string().min(1))
    .min(1, "Selectează cel puțin un membru"),
});
