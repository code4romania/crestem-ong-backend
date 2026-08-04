import { z } from "zod";

const phaseFields = {
  title: z
    .string({ message: "Titlul fazei este obligatoriu" })
    .trim()
    .min(1, "Titlul fazei este obligatoriu"),
  startDate: z.iso.date({ message: "Data de început a fazei este invalidă" }),
  endDate: z.iso.date({ message: "Data de sfârșit a fazei este invalidă" }),
  hasEvaluation: z.boolean({
    message: "Trebuie să specifici dacă faza are evaluare",
  }),
};

const phasesChecks = (
  phases: {
    title: string;
    startDate: string;
    endDate: string;
    hasEvaluation: boolean;
  }[],
  ctx: z.RefinementCtx,
) => {
  if (phases.length > 0 && !phases.some((phase) => phase.hasEvaluation)) {
    ctx.addIssue({
      code: "custom",
      message: "Cel puțin o fază trebuie să aibă evaluare",
    });
  }
  const titles = new Set<string>();
  for (const phase of phases) {
    const title = phase.title.toLowerCase();
    if (titles.has(title)) {
      ctx.addIssue({
        code: "custom",
        message: `Faza ${phase.title} apare de mai multe ori`,
      });
    }
    titles.add(title);
  }
  const sorted = [...phases].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startDate <= sorted[i - 1].endDate) {
      ctx.addIssue({
        code: "custom",
        message: `Fazele ${sorted[i - 1].title} și ${sorted[i].title} se suprapun`,
      });
    }
  }
};

const createPhaseSchema = z
  .object(phaseFields)
  .refine((phase) => phase.endDate >= phase.startDate, {
    message: "Data de sfârșit a fazei este înaintea datei de început",
  });

const updatePhaseSchema = z
  .object({
    documentId: z
      .string({ message: "Identificatorul fazei este invalid" })
      .optional(),
    ...phaseFields,
  })
  .refine((phase) => phase.endDate >= phase.startDate, {
    message: "Data de sfârșit a fazei este înaintea datei de început",
  });

export const phasesOutsideProgram = (
  phases: { startDate: string; endDate: string }[],
  startDate: string,
  endDate: string,
) =>
  phases.some(
    (phase) => phase.startDate < startDate || phase.endDate > endDate,
  );

export const createProgramSchema = z
  .object({
    name: z
      .string({ message: "Numele programului este obligatoriu" })
      .trim()
      .min(1, "Numele programului este obligatoriu"),
    startDate: z.iso.date({ message: "Data de început este invalidă" }),
    endDate: z.iso.date({ message: "Data de sfârșit este invalidă" }),
    phases: z
      .array(createPhaseSchema, { message: "Lista de faze este invalidă" })
      .min(1, "Programul trebuie să aibă cel puțin o fază")
      .superRefine(phasesChecks),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Data de sfârșit este înaintea datei de început",
  });

export const updateProgramSchema = z
  .object({
    name: z
      .string({ message: "Numele programului este invalid" })
      .trim()
      .min(1, "Numele programului este obligatoriu")
      .optional(),
    startDate: z.iso
      .date({ message: "Data de început este invalidă" })
      .optional(),
    endDate: z.iso
      .date({ message: "Data de sfârșit este invalidă" })
      .optional(),
    phases: z
      .array(updatePhaseSchema, { message: "Lista de faze este invalidă" })
      .min(1, "Programul trebuie să aibă cel puțin o fază")
      .superRefine(phasesChecks)
      .optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Trimite cel puțin un câmp",
  });
