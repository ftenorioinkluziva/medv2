import { z } from "zod";
import { Weekday } from "./workout-checklist";

export const TrainingItemKindSchema = z.enum(["exercise", "activity", "warmup", "mobility", "rest"]);

export const TrainingItemIntentSchema = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  kind: TrainingItemKindSchema,
  name: z.string().trim().min(1).max(200),
  searchText: z.string().trim().max(200).default(""),
  aliases: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  bodyPart: z.string().trim().max(100).nullable().default(null),
  target: z.string().trim().max(100).nullable().default(null),
  equipment: z.string().trim().max(100).nullable().default(null),
  sets: z.number().int().min(0).max(100).nullable().default(null),
  reps: z.string().max(100).default(""),
  duration: z.string().max(100).default(""),
  rest: z.string().max(100).default(""),
  notes: z.string().max(2000).default(""),
  prescription: z.string().max(3000).default("")
}).strict();

export const TrainingDayIntentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  message: z.string().max(5000).default(""),
  isRestDay: z.boolean(),
  items: z.array(TrainingItemIntentSchema).max(100)
}).strict();

export const TrainingPlanIntentSchema = z.object({
  "Segunda-feira": TrainingDayIntentSchema,
  "Terça-feira": TrainingDayIntentSchema,
  "Quarta-feira": TrainingDayIntentSchema,
  "Quinta-feira": TrainingDayIntentSchema,
  "Sexta-feira": TrainingDayIntentSchema,
  "Sábado": TrainingDayIntentSchema,
  "Domingo": TrainingDayIntentSchema
}).strict();

export const TrainingItemSchema = z.object({
  id: z.string().trim().min(1).max(200),
  kind: TrainingItemKindSchema,
  name: z.string().trim().min(1).max(200),
  exerciseId: z.string().trim().min(1).max(100).nullable(),
  sets: z.number().int().min(0).max(100).nullable(),
  reps: z.string().max(100),
  duration: z.string().max(100),
  rest: z.string().max(100),
  notes: z.string().max(2000),
  prescription: z.string().max(3000)
}).strict();

export const TrainingDaySchema = z.object({
  title: z.string().trim().min(1).max(300),
  message: z.string().max(5000),
  isRestDay: z.boolean(),
  items: z.array(TrainingItemSchema).max(100)
}).strict();

export const TrainingPlanSchema = z.object({
  "Segunda-feira": TrainingDaySchema,
  "Terça-feira": TrainingDaySchema,
  "Quarta-feira": TrainingDaySchema,
  "Quinta-feira": TrainingDaySchema,
  "Sexta-feira": TrainingDaySchema,
  "Sábado": TrainingDaySchema,
  "Domingo": TrainingDaySchema
}).strict();

export type TrainingItemKind = z.infer<typeof TrainingItemKindSchema>;
export type TrainingItemIntent = z.infer<typeof TrainingItemIntentSchema>;
export type TrainingDayIntent = z.infer<typeof TrainingDayIntentSchema>;
export type TrainingPlanIntent = z.infer<typeof TrainingPlanIntentSchema>;
export type TrainingItem = z.infer<typeof TrainingItemSchema>;
export type TrainingDay = z.infer<typeof TrainingDaySchema>;
export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;

export function emptyTrainingDay(weekday: Weekday): TrainingDay {
  return { title: `Treino de ${weekday}`, message: "", isRestDay: false, items: [] };
}

export function renderTrainingDay(day: TrainingDay): string {
  const lines = [`### ${day.title}`];
  for (const item of day.items) {
    const detail = item.prescription || [
      item.sets && item.reps ? `${item.sets} séries de ${item.reps} repetições` : "",
      item.duration,
      item.rest ? `Descanso: ${item.rest}` : "",
      item.notes ? `(${item.notes})` : ""
    ].filter(Boolean).join(" ");
    lines.push(`- **${item.name}:**${detail ? ` ${detail}` : ""}`);
  }
  return lines.join("\n");
}

export function renderTrainingPlan(plan: TrainingPlan): Record<Weekday, string> {
  return Object.fromEntries(
    Object.entries(plan).map(([weekday, day]) => [weekday, renderTrainingDay(day)])
  ) as Record<Weekday, string>;
}
