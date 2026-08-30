import { z } from "zod";

export const SettingsSchema = z.object({
  openrouterApiKey: z.string().default(""),
  modelExtraction: z.string().default("google/gemini-2.5-flash"),
  modelAnalysis: z.string().default("google/gemini-2.5-pro"),
  lens: z.enum(["longevidade", "convencional", "performance"]).default("longevidade"),
  lensLongevidade: z.string().optional(),
  lensConvencional: z.string().optional(),
  lensPerformance: z.string().optional()
});

export type Settings = z.infer<typeof SettingsSchema>;
