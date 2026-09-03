import { z } from "zod";

export const WEEKDAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo"
] as const;

export const WeekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const WorkoutTaskStatusSchema = z.enum(["pending", "completed", "review"]);
export type WorkoutTaskStatus = z.infer<typeof WorkoutTaskStatusSchema>;

export const WorkoutTaskCompletionSchema = z.object({
  analysisId: z.string().trim().min(1).max(200),
  weekday: WeekdaySchema,
  taskKey: z.string().trim().min(1).max(300),
  completed: z.boolean(),
  completedAt: z.string().datetime({ offset: true }).nullable()
}).strict();

export type WorkoutTaskCompletion = z.infer<typeof WorkoutTaskCompletionSchema>;

export const WorkoutChecklistQuerySchema = z.object({
  analysisId: z.string().trim().min(1).max(200).optional(),
  weekday: WeekdaySchema
}).strict();

export type WorkoutChecklistQuery = z.infer<typeof WorkoutChecklistQuerySchema>;

const ExerciseMediaUrlSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/api\/exercises\/[^/?#]+\/media\/(?:image|animation)$/)
]);

export const WorkoutTaskCompletionUpdateSchema = z.object({
  analysisId: z.string().trim().min(1).max(200),
  weekday: WeekdaySchema,
  taskKey: z.string().trim().min(1).max(300),
  completed: z.boolean()
}).strict();

export type WorkoutTaskCompletionUpdate = z.infer<typeof WorkoutTaskCompletionUpdateSchema>;

export const WorkoutChecklistTaskSchema = z.object({
  taskKey: z.string().trim().min(1).max(300),
  weekday: WeekdaySchema,
  order: z.number().int().positive(),
  sourceExerciseName: z.string().trim().min(1).max(200),
  exerciseId: z.string().trim().min(1).max(100).nullable(),
  exerciseName: z.string().trim().min(1).max(200).nullable(),
  bodyPart: z.string().trim().max(100).nullable(),
  target: z.string().trim().max(100).nullable(),
  imageUrl: ExerciseMediaUrlSchema.nullable(),
  animationUrl: ExerciseMediaUrlSchema.nullable(),
  steps: z.array(z.string().trim().min(1).max(1000)).max(20),
  prescription: z.string().trim().max(2000),
  status: WorkoutTaskStatusSchema,
  reviewReason: z.string().trim().max(500).nullable()
}).strict();

export type WorkoutChecklistTask = z.infer<typeof WorkoutChecklistTaskSchema>;

export const WorkoutChecklistDaySchema = z.object({
  weekday: WeekdaySchema,
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().max(5000),
  isRestDay: z.boolean(),
  tasks: z.array(WorkoutChecklistTaskSchema).max(100)
}).strict();

export type WorkoutChecklistDay = z.infer<typeof WorkoutChecklistDaySchema>;

export const WorkoutChecklistSchema = z.object({
  analysisId: z.string().trim().min(1).max(200),
  analysisDate: z.string().trim().min(1).max(100),
  weekday: WeekdaySchema,
  day: WorkoutChecklistDaySchema
}).strict();

export type WorkoutChecklist = z.infer<typeof WorkoutChecklistSchema>;
