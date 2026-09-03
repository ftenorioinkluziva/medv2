import { z } from "zod";

export const ExerciseMediaKindSchema = z.enum(["image", "animation"]);

export const ExerciseMediaSchema = z.object({
  exerciseId: z.string().trim().min(1).max(100),
  kind: ExerciseMediaKindSchema,
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/gif"]),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  contents: z.instanceof(Buffer)
}).strict();

export type ExerciseMediaKind = z.infer<typeof ExerciseMediaKindSchema>;
export type ExerciseMedia = z.infer<typeof ExerciseMediaSchema>;
