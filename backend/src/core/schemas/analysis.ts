import { z } from "zod";
import { BiomarkerItemSchema } from "./biomarkers";

export const SupplementationItemSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  dose: z.string(),
  frequency: z.string()
});

export const MealItemSchema = z.object({
  name: z.string(),
  time: z.string(),
  description: z.string(),
  proteinGrams: z.coerce.number(),
  fatGrams: z.coerce.number(),
  carbsGrams: z.coerce.number()
});

const DayNutritionSchema = z.union([
  z.string(),
  z.array(MealItemSchema)
]).default([]);

export const WeekdaysNutritionSchema = z.object({
  "Segunda-feira": DayNutritionSchema,
  "Terça-feira": DayNutritionSchema,
  "Quarta-feira": DayNutritionSchema,
  "Quinta-feira": DayNutritionSchema,
  "Sexta-feira": DayNutritionSchema,
  "Sábado": DayNutritionSchema,
  "Domingo": DayNutritionSchema
});

const WeekdaysSchema = z.object({
  "Segunda-feira": z.string().default(""),
  "Terça-feira": z.string().default(""),
  "Quarta-feira": z.string().default(""),
  "Quinta-feira": z.string().default(""),
  "Sexta-feira": z.string().default(""),
  "Sábado": z.string().default(""),
  "Domingo": z.string().default("")
});

export const DeterministicAlertSchema = z.object({
  biomarker: z.string(),
  value: z.any(),
  unit: z.string(),
  optimalRange: z.string(),
  severity: z.enum(["info", "warning", "danger"]),
  insight: z.string(),
  protocol: z.string(),
  source: z.string()
});

export const AnalysisLLMResponseSchema = z.object({
  healthStatus: z.string(),
  supplementation: z.array(SupplementationItemSchema).default([]),
  nutritionPlan: WeekdaysNutritionSchema,
  trainingPlan: WeekdaysSchema,
  nutritionOrientation: z.string().default(""),
  trainingOrientation: z.string().default("")
});

export const AnalysisSchema = z.object({
  id: z.string(),
  date: z.string(),
  bloodTestFilename: z.string(),
  biomarkers: z.array(BiomarkerItemSchema).default([]),
  healthStatus: z.string(),
  supplementation: z.array(SupplementationItemSchema).default([]),
  nutritionPlan: WeekdaysNutritionSchema,
  trainingPlan: WeekdaysSchema,
  deterministicAlerts: z.array(DeterministicAlertSchema).default([]),
  nutritionOrientation: z.string().default(""),
  trainingOrientation: z.string().default(""),
  createdAt: z.string(),
  annotations: z.string().optional().default("")
});

export type SupplementationItem = z.infer<typeof SupplementationItemSchema>;
export type AnalysisLLMResponse = z.infer<typeof AnalysisLLMResponseSchema>;
export type DeterministicAlert = z.infer<typeof DeterministicAlertSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;

