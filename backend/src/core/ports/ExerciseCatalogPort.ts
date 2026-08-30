import { Exercise } from "../schemas/exercise";

export type ExerciseAssetKind = "image" | "animation";

export interface ExerciseCatalogPort {
  getExercises(): Promise<Exercise[]>;
  getAssetUrl(exercise: Exercise, kind: ExerciseAssetKind): string | null;
}
