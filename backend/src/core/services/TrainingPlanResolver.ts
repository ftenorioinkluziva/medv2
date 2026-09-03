import { Exercise } from "../schemas/exercise";
import { Weekday } from "../schemas/workout-checklist";
import { TrainingDay, TrainingDayIntent, TrainingItemIntent, TrainingPlan, TrainingPlanIntent } from "../schemas/training-plan";
import { parseTrainingDay, resolveExerciseName } from "./WorkoutChecklistParser";

function prescriptionFor(item: TrainingItemIntent): string {
  if (item.prescription) return item.prescription;
  return [
    item.sets && item.reps ? `${item.sets} séries de ${item.reps} repetições` : "",
    item.duration,
    item.rest ? `Descanso: ${item.rest}` : "",
    item.notes ? `(${item.notes})` : ""
  ].filter(Boolean).join(" ");
}

function resolveItem(item: TrainingItemIntent, weekday: string, index: number, exercises: Exercise[]) {
  const shouldResolve = item.kind === "exercise" || item.kind === "activity";
  const searchTerms = [item.searchText, item.name, ...item.aliases].filter(Boolean);
  const matches = new Map<string, Exercise>();

  if (shouldResolve) {
    for (const term of searchTerms) {
      const match = resolveExerciseName(term, exercises);
      if (match) matches.set(match.id, match);
    }
  }

  // Só vincula automaticamente quando todas as descrições convergem para o mesmo ID.
  // Termos genéricos ou conflitantes permanecem para revisão profissional.
  const exercise = matches.size === 1 ? [...matches.values()][0] : null;
  return {
    id: item.id || `${weekday}-${index + 1}`,
    kind: item.kind,
    name: item.name,
    exerciseId: exercise?.id || null,
    sets: item.sets,
    reps: item.reps,
    duration: item.duration,
    rest: item.rest,
    notes: item.notes,
    prescription: prescriptionFor(item)
  };
}

function resolveDay(day: TrainingDayIntent, weekday: string, exercises: Exercise[]): TrainingDay {
  return {
    title: day.title,
    message: day.message,
    isRestDay: day.isRestDay,
    items: day.items.map((item, index) => resolveItem(item, weekday, index, exercises))
  };
}

export function resolveTrainingPlanIntent(intent: TrainingPlanIntent, exercises: Exercise[]): TrainingPlan {
  return Object.fromEntries(
    Object.entries(intent).map(([weekday, day]) => [weekday, resolveDay(day, weekday, exercises)])
  ) as TrainingPlan;
}

export function resolveLegacyTrainingPlan(trainingPlan: Record<string, string>, exercises: Exercise[]): TrainingPlan {
  return Object.fromEntries(
    Object.entries(trainingPlan).map(([weekday, text]) => {
      const parsed = parseTrainingDay(text, weekday as Weekday);
      return [weekday, {
        ...parsed,
        items: parsed.items.map((item) => {
          if (item.kind !== "exercise" && item.kind !== "activity") return item;
          const exercise = resolveExerciseName(item.name, exercises);
          return { ...item, exerciseId: exercise?.id || null };
        })
      }];
    })
  ) as TrainingPlan;
}
