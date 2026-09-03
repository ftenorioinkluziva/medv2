import { z } from "zod";

export const SettingsUpdateSchema = z.object({
  openrouterApiKey: z.string().trim().max(512).optional(),
  modelExtraction: z.string().trim().min(1).max(200).optional(),
  modelAnalysis: z.string().trim().min(1).max(200).optional(),
  lens: z.enum(["longevidade", "convencional", "performance"]).optional(),
  lensLongevidade: z.string().max(20_000).optional(),
  lensConvencional: z.string().max(20_000).optional(),
  lensPerformance: z.string().max(20_000).optional()
}).strict();

export const AnnotationUpdateSchema = z.object({
  annotations: z.string().max(50_000)
}).strict();

export const DocumentTypeSchema = z.enum(["blood-test", "bioimpedance"]);

export const ExerciseQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  bodyPart: z.string().trim().max(100).optional(),
  target: z.string().trim().max(100).optional()
}).strict();

export const ResourceIdSchema = z.string().trim().min(1).max(200);

export const ExerciseMediaRequestSchema = z.object({
  exerciseId: ResourceIdSchema,
  kind: z.enum(["image", "animation"])
}).strict();

export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;
export type ExerciseQuery = z.infer<typeof ExerciseQuerySchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type ExerciseMediaRequest = z.infer<typeof ExerciseMediaRequestSchema>;
