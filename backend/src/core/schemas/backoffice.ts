import { z } from "zod";
import { Analysis, PlanContentSchema } from "./analysis";
import { parseTrainingDay } from "../services/WorkoutChecklistParser";
import { renderTrainingPlan, TrainingPlanSchema } from "./training-plan";

export const UserRoleSchema = z.enum(["patient", "professional"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const PlanRevisionStatusSchema = z.enum(["draft", "published", "archived"]);
export type PlanRevisionStatus = z.infer<typeof PlanRevisionStatusSchema>;

export const PlanRevisionSourceSchema = z.enum(["manual"]);

export const PlanRevisionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  patientId: z.string().trim().min(1).max(200),
  analysisId: z.string().trim().min(1).max(200),
  analysisVersion: z.number().int().positive(),
  version: z.number().int().positive(),
  status: PlanRevisionStatusSchema,
  source: PlanRevisionSourceSchema,
  content: PlanContentSchema,
  createdBy: z.string().trim().min(1).max(200),
  publishedBy: z.string().trim().min(1).max(200).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  publishedAt: z.string().datetime({ offset: true }).nullable()
}).strict();
export type PlanRevision = z.infer<typeof PlanRevisionSchema>;

export const BackofficePatientSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(320),
  analyses: z.array(z.object({
    id: z.string().trim().min(1).max(200),
    date: z.string().trim().min(1).max(100),
    bloodTestFilename: z.string().max(255),
    createdAt: z.string().datetime({ offset: true })
  }).strict())
}).strict();
export type BackofficePatient = z.infer<typeof BackofficePatientSchema>;

export const BackofficePlanEditorSchema = z.object({
  patient: BackofficePatientSchema.omit({ analyses: true }),
  analysis: z.object({
    id: z.string().trim().min(1).max(200),
    date: z.string().trim().min(1).max(100),
    bloodTestFilename: z.string().max(255),
    createdAt: z.string().datetime({ offset: true })
  }).strict(),
  generated: PlanContentSchema,
  published: PlanRevisionSchema.nullable(),
  draft: PlanRevisionSchema.nullable(),
  history: z.array(PlanRevisionSchema)
}).strict();
export type BackofficePlanEditor = z.infer<typeof BackofficePlanEditorSchema>;

export const BackofficePlanInputSchema = z.object({
  patientId: z.string().trim().min(1).max(200),
  analysisId: z.string().trim().min(1).max(200)
}).strict();
export type BackofficePlanInput = z.infer<typeof BackofficePlanInputSchema>;

export const SavePlanDraftInputSchema = BackofficePlanInputSchema.extend({
  content: PlanContentSchema
}).strict();
export type SavePlanDraftInput = z.infer<typeof SavePlanDraftInputSchema>;

export type BackofficeAnalysis = BackofficePatient["analyses"][number];

export function ensureStructuredPlanContent(content: unknown) {
  const parsed = PlanContentSchema.parse(content);
  if (parsed.trainingPlanStructured) {
    return { ...parsed, trainingPlan: renderTrainingPlan(parsed.trainingPlanStructured) };
  }
  const structuredTrainingPlan = Object.fromEntries(
    Object.entries(parsed.trainingPlan).map(([weekday, text]) => [weekday, parseTrainingDay(text, weekday as keyof typeof parsed.trainingPlan)])
  );
  const structured = TrainingPlanSchema.parse(structuredTrainingPlan);
  return { ...parsed, trainingPlan: renderTrainingPlan(structured), trainingPlanStructured: structured };
}

export function planContentFromAnalysis(analysis: Analysis) {
  const structuredTrainingPlan = Object.fromEntries(
    Object.entries(analysis.trainingPlan).map(([weekday, text]) => [weekday, parseTrainingDay(text, weekday as keyof typeof analysis.trainingPlan)])
  );
  return ensureStructuredPlanContent({
    supplementation: analysis.supplementation,
    nutritionPlan: analysis.nutritionPlan,
    trainingPlan: analysis.trainingPlan,
    trainingPlanStructured: structuredTrainingPlan,
    nutritionOrientation: analysis.nutritionOrientation,
    trainingOrientation: analysis.trainingOrientation
  });
}
