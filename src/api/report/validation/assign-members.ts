import { z } from "zod";

export const assignMembersSchema = z
  .object({
    program: z.string().min(1).optional(),
    report: z.string().min(1).optional(),
    members: z
      .array(z.string().min(1))
      .min(1, "Selectează cel puțin un membru"),
  })
  .refine((data) => Boolean(data.program) !== Boolean(data.report), {
    message: "Trimite exact unul dintre câmpurile program sau report",
  });
