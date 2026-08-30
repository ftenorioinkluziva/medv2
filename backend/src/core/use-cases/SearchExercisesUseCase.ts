import { ExerciseCatalogPort } from "../ports/ExerciseCatalogPort";
import { Exercise } from "../schemas/exercise";
import { ExerciseQuery } from "../schemas/operations";
import { DETERMINISTIC_ALIASES } from "./MapWorkoutContractUseCase";

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
      const text = query.q.toLowerCase();
      const aliases = new Set<string>();
      for (const [alias, id] of Object.entries(DETERMINISTIC_ALIASES)) {
        if (alias.includes(text) || text.includes(alias)) aliases.add(id);
      }
      exercises = exercises.filter((exercise) =>
        exercise.n.toLowerCase().includes(text)
        || exercise.id.toLowerCase() === text
        || aliases.has(exercise.id)
      );
    }
    return exercises.slice(0, 50);
  }
}
