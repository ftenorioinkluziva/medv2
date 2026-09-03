import { Exercise } from "../schemas/exercise";
import { ExerciseMediaKind } from "../schemas/exercise-media";

export type ExerciseAssetKind = ExerciseMediaKind;

export interface ExerciseCatalogPort {
  getExercises(): Promise<Exercise[]>;
  getAssetUrl(exercise: Exercise, kind: ExerciseAssetKind): string | null;
}
