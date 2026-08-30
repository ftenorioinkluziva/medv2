import { z } from "zod";

export const ExerciseSchema = z.object({
  id: z.string(),
  n: z.string(),
  bp: z.string().optional(),
  tg: z.string().optional(),
  eq: z.string().optional(),
  mg: z.string().optional(),
  sm: z.array(z.string()).optional(),
  st: z.array(z.string()).optional(),
  stPt: z.array(z.string()).optional(),
  img: z.string().optional(),
  gif: z.string().optional()
}).passthrough();

export const ExerciseInstructionTranslationsSchema = z.record(
  z.string().trim().min(1),
  z.array(z.string().trim().min(1).max(1000)).max(20)
);

export type Exercise = z.infer<typeof ExerciseSchema>;
export type ExerciseInstructionTranslations = z.infer<typeof ExerciseInstructionTranslationsSchema>;
