import { DatabasePort } from "../ports/DatabasePort";
import { ExerciseCatalogPort } from "../ports/ExerciseCatalogPort";
import { RuntimePort } from "../ports/RuntimePort";
import {
  WorkoutChecklist,
  WorkoutChecklistDaySchema,
  WorkoutChecklistQuery,
  WorkoutChecklistSchema,
  WorkoutTaskCompletion,
  WorkoutTaskCompletionUpdate,
  WorkoutTaskStatus,
  WorkoutTaskCompletionSchema
} from "../schemas/workout-checklist";
import { resolveExerciseName, parseWorkoutDay } from "../services/WorkoutChecklistParser";
import { Result } from "../types/Result";
import { OperationError } from "../types/errors";

function error(code: string, category: OperationError["category"], message: string): Result<never> {
  return { ok: false, error: { code, category, message, retryable: false } };
}

function selectAnalysis(analyses: Awaited<ReturnType<DatabasePort["getAnalyses"]>>, analysisId?: string) {
  if (analysisId) return analyses.find((analysis) => analysis.id === analysisId) || null;
  return [...analyses].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] || null;
}

export class GetWorkoutChecklistUseCase {
  constructor(
    private readonly db: DatabasePort,
    private readonly catalog: ExerciseCatalogPort
  ) {}

  async execute(userId: string, input: WorkoutChecklistQuery): Promise<Result<WorkoutChecklist>> {
    const analyses = await this.db.getAnalyses(userId);
    const analysis = selectAnalysis(analyses, input.analysisId);
    if (!analysis) {
      return error(
        input.analysisId ? "ANALYSIS_NOT_FOUND" : "NO_ANALYSIS_FOUND",
        "validation",
        input.analysisId ? "A análise selecionada não foi encontrada." : "Nenhuma análise clínica encontrada."
      );
    }

    const structuredDay = analysis.trainingPlanStructured?.[input.weekday];
    const legacyDay = parseWorkoutDay(analysis.trainingPlan[input.weekday] || "", input.weekday);
    const parsedDay = structuredDay || legacyDay;
    const exercises = await this.catalog.getExercises();
    const completions = await this.db.getWorkoutTaskCompletions(userId, analysis.id, input.weekday);
    const completionByTask = new Map(completions.map((completion) => [completion.taskKey, completion]));

    const parsedTasks = structuredDay
      ? structuredDay.items
        .filter((item) => item.kind === "exercise" || item.kind === "activity")
        .map((item) => ({ itemId: item.id, sourceExerciseName: item.exerciseId || item.name, prescription: item.prescription }))
      : legacyDay.tasks.map((task, index) => ({ itemId: String(index + 1), sourceExerciseName: task.sourceExerciseName, prescription: task.prescription }));
    const tasks = parsedTasks.map((task, index) => {
      const taskKey = structuredDay ? `${analysis.id}:${input.weekday}:${task.itemId}` : `${analysis.id}:${input.weekday}:${index + 1}`;
      const exercise = resolveExerciseName(task.sourceExerciseName, exercises);
      const completion = completionByTask.get(taskKey);
      const status: WorkoutTaskStatus = !exercise
        ? "review"
        : completion?.completed
          ? "completed"
          : "pending";

      return {
        taskKey,
        weekday: input.weekday,
        order: index + 1,
        sourceExerciseName: task.sourceExerciseName,
        exerciseId: exercise?.id || null,
        exerciseName: exercise?.n || null,
        bodyPart: exercise?.bp || null,
        target: exercise?.tg || null,
        imageUrl: exercise ? this.catalog.getAssetUrl(exercise, "image") : null,
        animationUrl: exercise ? this.catalog.getAssetUrl(exercise, "animation") : null,
        steps: exercise?.stPt?.length ? exercise.stPt : exercise?.st || [],
        prescription: task.prescription,
        status,
        reviewReason: exercise ? null : "Exercício não localizado com segurança no catálogo local."
      };
    });

    return {
      ok: true,
      value: WorkoutChecklistSchema.parse({
        analysisId: analysis.id,
        analysisDate: analysis.date,
        weekday: input.weekday,
        day: WorkoutChecklistDaySchema.parse({
          weekday: input.weekday,
          title: parsedDay.title,
          message: parsedDay.message,
          isRestDay: parsedDay.isRestDay,
          tasks
        })
      })
    };
  }
}

export class UpdateWorkoutTaskCompletionUseCase {
  constructor(
    private readonly db: DatabasePort,
    private readonly checklist: GetWorkoutChecklistUseCase,
    private readonly runtime: RuntimePort
  ) {}

  async execute(userId: string, input: WorkoutTaskCompletionUpdate): Promise<Result<WorkoutTaskCompletion>> {
    const current = await this.checklist.execute(userId, {
      analysisId: input.analysisId,
      weekday: input.weekday
    });
    if (!current.ok) return current;

    const task = current.value.day.tasks.find((candidate) => candidate.taskKey === input.taskKey);
    if (!task) {
      return error("WORKOUT_TASK_NOT_FOUND", "validation", "A tarefa de treino não foi encontrada.");
    }
    if (task.status === "review" || !task.exerciseId) {
      return error("WORKOUT_TASK_REQUIRES_REVIEW", "validation", "Esta tarefa precisa ser revisada antes de ser concluída.");
    }

    const completion = WorkoutTaskCompletionSchema.parse({
      analysisId: input.analysisId,
      weekday: input.weekday,
      taskKey: input.taskKey,
      completed: input.completed,
      completedAt: input.completed ? this.runtime.now().toISOString() : null
    });
    await this.db.saveWorkoutTaskCompletion(userId, completion);
    return { ok: true, value: completion };
  }
}
