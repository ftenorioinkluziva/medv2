import fs from "fs";
import { ExerciseAssetKind, ExerciseCatalogPort } from "../../core/ports/ExerciseCatalogPort";
import { Exercise, ExerciseInstructionTranslations, ExerciseInstructionTranslationsSchema, ExerciseSchema } from "../../core/schemas/exercise";
import { OperationFailure } from "../../core/types/errors";

export interface ExerciseAssetBaseUrls {
  image?: string;
  animation?: string;
}

export class JsonExerciseCatalogAdapter implements ExerciseCatalogPort {
  private readonly assetBaseUrls: Required<ExerciseAssetBaseUrls>;

  constructor(
    private readonly filePath: string,
    assetBaseUrls: ExerciseAssetBaseUrls = {},
    private readonly instructionTranslationsFilePath?: string
  ) {
    this.assetBaseUrls = {
      image: assetBaseUrls.image || "",
      animation: assetBaseUrls.animation || ""
    };
  }

  async getExercises(): Promise<Exercise[]> {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const exercises = ExerciseSchema.array().parse(JSON.parse(fs.readFileSync(this.filePath, "utf8")));
      const translations = this.readInstructionTranslations();
      const catalogIds = new Set(exercises.map((exercise) => exercise.id));
      const unknownTranslationId = Object.keys(translations).find((id) => !catalogIds.has(id));
      const missingTranslationId = this.instructionTranslationsFilePath
        ? exercises.find((exercise) => !translations[exercise.id])?.id
        : undefined;
      const mismatchedTranslationId = exercises.find((exercise) => {
        const translatedSteps = translations[exercise.id];
        return translatedSteps
          && translatedSteps.length !== (exercise.st || []).length;
      })?.id;
      const unchangedTranslationId = exercises.find((exercise) => {
        const translatedSteps = translations[exercise.id];
        return translatedSteps
          && exercise.st?.some((step, index) => translatedSteps[index] === step);
      })?.id;
      if (unknownTranslationId || missingTranslationId || mismatchedTranslationId || unchangedTranslationId) {
        throw new OperationFailure({
          code: "EXERCISE_TRANSLATIONS_INVALID",
          category: "internal",
          message: "As instruções localizadas não correspondem integralmente ao catálogo de exercícios.",
          retryable: false
        });
      }
      return exercises.map((exercise) => translations[exercise.id]
        ? { ...exercise, stPt: translations[exercise.id] }
        : exercise);
    } catch (error) {
      if (error instanceof OperationFailure) throw error;
      throw new OperationFailure({
        code: "EXERCISE_CATALOG_INVALID",
        category: "internal",
        message: "O catálogo de exercícios não pôde ser carregado.",
        retryable: false
      }, { cause: error });
    }
  }

  private readInstructionTranslations(): ExerciseInstructionTranslations {
    if (!this.instructionTranslationsFilePath) return {};
    if (!fs.existsSync(this.instructionTranslationsFilePath)) {
      throw new OperationFailure({
        code: "EXERCISE_TRANSLATIONS_NOT_FOUND",
        category: "internal",
        message: "O pacote local de instruções em português não foi encontrado.",
        retryable: false
      });
    }
    try {
      return ExerciseInstructionTranslationsSchema.parse(JSON.parse(fs.readFileSync(this.instructionTranslationsFilePath, "utf8")));
    } catch (error) {
      if (error instanceof OperationFailure) throw error;
      throw new OperationFailure({
        code: "EXERCISE_TRANSLATIONS_INVALID",
        category: "internal",
        message: "O pacote local de instruções em português não pôde ser carregado.",
        retryable: false
      }, { cause: error });
    }
  }

  getAssetUrl(exercise: Exercise, kind: ExerciseAssetKind): string | null {
    const filename = kind === "image" ? exercise.img : exercise.gif;
    const baseUrl = this.assetBaseUrls[kind];
    if (!filename || !baseUrl || filename !== filename.split(/[\\/]/).pop()) return null;

    try {
      return new URL(encodeURIComponent(filename), `${baseUrl.replace(/\/+$/, "")}/`).toString();
    } catch {
      return null;
    }
  }
}
