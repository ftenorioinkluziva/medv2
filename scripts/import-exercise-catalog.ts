import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import {
  ExerciseInstructionTranslationsSchema,
  ExerciseSchema,
  type Exercise
} from "../backend/src/core/schemas/exercise";

type CatalogModule = { EXDB?: unknown };
type MediaSpec = {
  kind: "image" | "animation";
  field: "img" | "gif";
  directory: string;
  mimeType: "image/jpeg" | "image/gif";
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function option(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requiredOption(name: string, fallback?: string): string {
  const value = option(name, fallback)?.trim();
  if (!value) throw new Error(`Informe ${name}.`);
  return path.resolve(value);
}

async function loadExercises(catalogPath: string): Promise<Exercise[]> {
  const imported = await import(pathToFileURL(catalogPath).href) as CatalogModule;
  return ExerciseSchema.array().parse(imported.EXDB);
}

async function loadTranslations(translationsPath: string, exercises: Exercise[]): Promise<Record<string, string[]>> {
  const translations = ExerciseInstructionTranslationsSchema.parse(
    JSON.parse(await fs.readFile(translationsPath, "utf8"))
  );
  for (const exercise of exercises) {
    const translated = translations[exercise.id];
    if (!translated || translated.length !== (exercise.st || []).length) {
      throw new Error(`Instruções em português ausentes ou incompatíveis para o exercício ${exercise.id}.`);
    }
  }
  return translations;
}

function validateFilename(exercise: Exercise, filename: string, expectedExtension: string): void {
  if (filename.includes("\0") || path.basename(filename) !== filename || path.extname(filename).toLowerCase() !== expectedExtension) {
    throw new Error(`Nome de mídia inválido para o exercício ${exercise.id}.`);
  }
}

async function validateMediaFiles(exercises: Exercise[], specs: MediaSpec[]): Promise<void> {
  for (const exercise of exercises) {
    for (const spec of specs) {
      const filename = exercise[spec.field];
      if (!filename) continue;
      validateFilename(exercise, filename, spec.kind === "image" ? ".jpg" : ".gif");
      const filePath = path.join(spec.directory, filename);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) throw new Error(`A mídia não é um arquivo regular para o exercício ${exercise.id}.`);
    }
  }
}

async function readMedia(exercise: Exercise, spec: MediaSpec): Promise<{ filename: string; contents: Buffer } | null> {
  const filename = exercise[spec.field];
  if (!filename) return null;
  return { filename, contents: await fs.readFile(path.join(spec.directory, filename)) };
}

async function main(): Promise<void> {
  const catalogPath = requiredOption("--catalog", process.env.MEDV2_EXERCISE_CATALOG);
  const imageDirectory = requiredOption("--image-dir", process.env.MEDV2_EXERCISE_IMAGE_DIR);
  const gifDirectory = requiredOption("--gif-dir", process.env.MEDV2_EXERCISE_GIF_DIR);
  const translationsPath = requiredOption(
    "--translations",
    path.join(root, "backend", "data", "exercise-instructions.pt-BR.json")
  );
  const exercises = await loadExercises(catalogPath);
  const translations = await loadTranslations(translationsPath, exercises);
  const mediaSpecs: MediaSpec[] = [
    { kind: "image", field: "img", directory: imageDirectory, mimeType: "image/jpeg" },
    { kind: "animation", field: "gif", directory: gifDirectory, mimeType: "image/gif" }
  ];
  await validateMediaFiles(exercises, mediaSpecs);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL é obrigatório para importar o catálogo de exercícios.");
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  let totalBytes = 0;
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.exercise_catalog_write', 'true', true)");
    for (let index = 0; index < exercises.length; index += 1) {
      const exercise = exercises[index];
      await client.query(`
        INSERT INTO medv2_exercise(
          id, name, body_part, equipment, target, primary_muscle,
          secondary_muscles, instructions, instructions_pt, source_key, active, "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, TRUE, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          body_part = EXCLUDED.body_part,
          equipment = EXCLUDED.equipment,
          target = EXCLUDED.target,
          primary_muscle = EXCLUDED.primary_muscle,
          secondary_muscles = EXCLUDED.secondary_muscles,
          instructions = EXCLUDED.instructions,
          instructions_pt = EXCLUDED.instructions_pt,
          source_key = EXCLUDED.source_key,
          active = TRUE,
          "updatedAt" = NOW()
      `, [
        exercise.id,
        exercise.n,
        exercise.bp || null,
        exercise.eq || null,
        exercise.tg || null,
        exercise.mg || null,
        JSON.stringify(exercise.sm || []),
        JSON.stringify(exercise.st || []),
        JSON.stringify(translations[exercise.id] || []),
        "local-catalog"
      ]);

      await client.query("DELETE FROM medv2_exercise_media WHERE \"exerciseId\" = $1", [exercise.id]);
      for (const spec of mediaSpecs) {
        const media = await readMedia(exercise, spec);
        if (!media) continue;
        const sha256 = crypto.createHash("sha256").update(media.contents).digest("hex");
        totalBytes += media.contents.byteLength;
        await client.query(`
          INSERT INTO medv2_exercise_media(
            "exerciseId", kind, filename, mime_type, size_bytes, sha256, content, "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [exercise.id, spec.kind, media.filename, spec.mimeType, media.contents.byteLength, sha256, media.contents]);
      }
      if ((index + 1) % 100 === 0 || index + 1 === exercises.length) {
        console.log(`[db:exercise-import] ${index + 1}/${exercises.length}`);
      }
    }
    await client.query("COMMIT");
    console.log(`[db:exercise-import] concluído: ${exercises.length} exercícios, ${totalBytes} bytes de mídia.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:exercise-import] falhou", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
