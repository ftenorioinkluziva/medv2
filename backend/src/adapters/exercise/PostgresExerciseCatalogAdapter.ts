import pg from "pg";
import { ExerciseAssetKind, ExerciseCatalogPort } from "../../core/ports/ExerciseCatalogPort";
import { ExerciseMediaPort } from "../../core/ports/ExerciseMediaPort";
import { ExerciseMedia, ExerciseMediaKind, ExerciseMediaSchema } from "../../core/schemas/exercise-media";
import { Exercise, ExerciseSchema } from "../../core/schemas/exercise";
import { OperationFailure } from "../../core/types/errors";
import { getPool } from "../database/PostgresPool";

function catalogFailure(message: string, cause: unknown): OperationFailure {
  return new OperationFailure({
    code: "EXERCISE_CATALOG_QUERY_FAILED",
    category: "internal",
    message,
    retryable: true
  }, { cause });
}

export class PostgresExerciseCatalogAdapter implements ExerciseCatalogPort, ExerciseMediaPort {
  private readonly pool = getPool();

  async getExercises(): Promise<Exercise[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          e.id,
          e.name AS n,
          e.body_part AS bp,
          e.equipment AS eq,
          e.target AS tg,
          e.primary_muscle AS mg,
          e.secondary_muscles AS sm,
          e.instructions AS st,
          e.instructions_pt AS "stPt",
          MAX(m.filename) FILTER (WHERE m.kind = 'image') AS img,
          MAX(m.filename) FILTER (WHERE m.kind = 'animation') AS gif
        FROM medv2_exercise e
        LEFT JOIN medv2_exercise_media m ON m."exerciseId" = e.id
        WHERE e.active = TRUE
        GROUP BY e.id, e.name, e.body_part, e.equipment, e.target, e.primary_muscle,
                 e.secondary_muscles, e.instructions, e.instructions_pt
        ORDER BY e.id
      `);
      return ExerciseSchema.array().parse(result.rows);
    } catch (error) {
      if (error instanceof OperationFailure) throw error;
      throw catalogFailure("O catálogo de exercícios não pôde ser carregado do banco.", error);
    }
  }

  getAssetUrl(exercise: Exercise, kind: ExerciseAssetKind): string | null {
    const filename = kind === "image" ? exercise.img : exercise.gif;
    if (!filename) return null;
    return `/api/exercises/${encodeURIComponent(exercise.id)}/media/${kind}`;
  }

  async getMedia(exerciseId: string, kind: ExerciseMediaKind): Promise<ExerciseMedia | null> {
    try {
      const result = await this.pool.query(`
        SELECT "exerciseId", kind, filename, mime_type AS "mimeType",
               size_bytes AS "sizeBytes", sha256, content
        FROM medv2_exercise_media
        WHERE "exerciseId" = $1 AND kind = $2
      `, [exerciseId, kind]);
      const row = result.rows[0];
      if (!row) return null;
      return ExerciseMediaSchema.parse({
        exerciseId: row.exerciseId,
        kind: row.kind,
        filename: row.filename,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        sha256: row.sha256,
        contents: row.content
      });
    } catch (error) {
      if (error instanceof OperationFailure) throw error;
      throw catalogFailure("A mídia do exercício não pôde ser carregada do banco.", error);
    }
  }
}
