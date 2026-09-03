import { ExerciseMediaPort } from "../ports/ExerciseMediaPort";
import { ExerciseMediaRequestSchema } from "../schemas/operations";
import { Result } from "../types/Result";
import { OperationError } from "../types/errors";
import { ExerciseMedia } from "../schemas/exercise-media";

function failure(code: string, category: OperationError["category"], message: string): Result<never> {
  return { ok: false, error: { code, category, message, retryable: false } };
}

export class GetExerciseMediaUseCase {
  constructor(private readonly media: ExerciseMediaPort) {}

  async execute(input: unknown): Promise<Result<ExerciseMedia>> {
    const parsed = ExerciseMediaRequestSchema.safeParse(input);
    if (!parsed.success) return failure("INVALID_INPUT", "validation", "A mídia solicitada é inválida.");

    const result = await this.media.getMedia(parsed.data.exerciseId, parsed.data.kind);
    if (!result) return failure("EXERCISE_MEDIA_NOT_FOUND", "validation", "A mídia do exercício não foi encontrada.");
    return { ok: true, value: result };
  }
}
