import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Mesajul nu poate fi gol"),
});
