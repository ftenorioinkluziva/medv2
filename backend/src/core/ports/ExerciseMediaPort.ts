import { ExerciseMedia, ExerciseMediaKind } from "../schemas/exercise-media";

export interface ExerciseMediaPort {
  getMedia(exerciseId: string, kind: ExerciseMediaKind): Promise<ExerciseMedia | null>;
}
