import { z } from "zod";

export const StructuredBiomarkerHistorySchema = z.object({
  analysisId: z.string(),
  analysisVersion: z.number().int(),
  date: z.string(),
  biomarkerCode: z.string(),
  biomarkerName: z.string(),
  valueNumeric: z.number().nullable(),
  valueText: z.string(),
  unit: z.string(),
  status: z.enum(["normal", "alto", "baixo", "alterado"]),
  referenceRange: z.string(),
  annotations: z.string()
});

export const StructuredBiomarkerHistorySchemaArray = StructuredBiomarkerHistorySchema.array();
export type StructuredBiomarkerHistory = z.infer<typeof StructuredBiomarkerHistorySchema>;
