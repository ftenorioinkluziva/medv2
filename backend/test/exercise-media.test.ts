import assert from "node:assert/strict";
import test from "node:test";
import { ExerciseMediaPort } from "../src/core/ports/ExerciseMediaPort";
import { GetExerciseMediaUseCase } from "../src/core/use-cases/GetExerciseMediaUseCase";

const media = {
  exerciseId: "0001",
  kind: "image" as const,
  filename: "0001-preview.jpg",
  mimeType: "image/jpeg" as const,
  sizeBytes: 3,
  sha256: "a".repeat(64),
  contents: Buffer.from([1, 2, 3])
};

test("exercise media use case validates input and returns persisted media", async () => {
  const port: ExerciseMediaPort = { getMedia: async () => media };
  const result = await new GetExerciseMediaUseCase(port).execute({ exerciseId: "0001", kind: "image" });

  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.contents, media.contents);
});

test("exercise media use case rejects invalid media kinds", async () => {
  const port: ExerciseMediaPort = { getMedia: async () => media };
  const result = await new GetExerciseMediaUseCase(port).execute({ exerciseId: "0001", kind: "video" });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "INVALID_INPUT");
});

test("exercise media use case exposes a stable not-found error", async () => {
  const port: ExerciseMediaPort = { getMedia: async () => null };
  const result = await new GetExerciseMediaUseCase(port).execute({ exerciseId: "missing", kind: "image" });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "EXERCISE_MEDIA_NOT_FOUND");
});
