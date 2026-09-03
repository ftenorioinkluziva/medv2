import { ExerciseCatalogPort } from "../ports/ExerciseCatalogPort";
import { Exercise } from "../schemas/exercise";
import { ExerciseQuery } from "../schemas/operations";
import { DETERMINISTIC_ALIASES } from "../services/WorkoutExerciseAliases";
import { normalizeWorkoutText } from "../services/WorkoutChecklistParser";

function portugueseAliasesFor(exerciseId: string): string[] {
  return Object.entries(DETERMINISTIC_ALIASES)
    .filter(([, id]) => id === exerciseId)
    .map(([alias]) => alias)
    .sort((left, right) => right.length - left.length);
}

export class SearchExercisesUseCase {
  constructor(private readonly catalog: ExerciseCatalogPort) {}

  async execute(query: ExerciseQuery): Promise<Exercise[]> {
    let exercises = await this.catalog.getExercises();
    if (query.bodyPart) {
      const bodyPart = query.bodyPart.toLowerCase();
      exercises = exercises.filter((exercise) => exercise.bp?.toLowerCase() === bodyPart);
    }
    if (query.target) {
      const target = query.target.toLowerCase();
      exercises = exercises.filter((exercise) => exercise.tg?.toLowerCase() === target);
    }
    if (query.q) {
      const text = normalizeWorkoutText(query.q);
      const aliases = new Set<string>();
      for (const [alias, id] of Object.entries(DETERMINISTIC_ALIASES)) {
        const normalizedAlias = normalizeWorkoutText(alias);
        if (normalizedAlias.includes(text) || text.includes(normalizedAlias)) aliases.add(id);
      }
      exercises = exercises.filter((exercise) =>
        normalizeWorkoutText(exercise.n).includes(text)
        || normalizeWorkoutText(exercise.bp || "").includes(text)
        || normalizeWorkoutText(exercise.eq || "").includes(text)
        || normalizeWorkoutText(exercise.tg || "").includes(text)
        || normalizeWorkoutText(exercise.mg || "").includes(text)
        || (exercise.sm || []).some((muscle) => normalizeWorkoutText(muscle).includes(text))
        || (exercise.stPt || []).some((instruction) => normalizeWorkoutText(instruction).includes(text))
        || (exercise.st || []).some((instruction) => normalizeWorkoutText(instruction).includes(text))
        || exercise.id.toLowerCase() === text
        || aliases.has(exercise.id)
      );
    }
    return exercises.slice(0, 50).map((exercise) => ({
      ...exercise,
      aliasesPt: portugueseAliasesFor(exercise.id),
      namePt: portugueseAliasesFor(exercise.id)[0]
    }));
  }
}
