import { ExerciseCatalogPort } from "../ports/ExerciseCatalogPort";
import { TrainingPlanIntent, TrainingPlan } from "../schemas/training-plan";
import { resolveLegacyTrainingPlan, resolveTrainingPlanIntent } from "../services/TrainingPlanResolver";

export class ResolveTrainingPlanUseCase {
  constructor(private readonly catalog: ExerciseCatalogPort) {}

  async execute(input: {
    trainingPlan: Record<string, string>;
    trainingPlanIntent?: TrainingPlanIntent | null;
  }): Promise<TrainingPlan> {
    const exercises = await this.catalog.getExercises();
    return input.trainingPlanIntent
      ? resolveTrainingPlanIntent(input.trainingPlanIntent, exercises)
      : resolveLegacyTrainingPlan(input.trainingPlan, exercises);
  }
}
