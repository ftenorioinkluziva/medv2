import assert from "node:assert/strict";
import test from "node:test";
import { Analysis, AnalysisSchema } from "../src/core/schemas/analysis";
import { Document } from "../src/core/schemas/document";
import { Profile } from "../src/core/schemas/profile";
import { Settings } from "../src/core/schemas/settings";
import { StructuredBiomarkerHistory } from "../src/core/schemas/biomarker-history";
import { Exercise } from "../src/core/schemas/exercise";
import { Weekday, WorkoutTaskCompletion } from "../src/core/schemas/workout-checklist";
import { DatabasePort } from "../src/core/ports/DatabasePort";
import { ExerciseCatalogPort } from "../src/core/ports/ExerciseCatalogPort";
import { JsonExerciseCatalogAdapter } from "../src/adapters/exercise/JsonExerciseCatalogAdapter";
import { RuntimePort } from "../src/core/ports/RuntimePort";
import { parseTrainingDay, parseWorkoutDay, resolveExerciseName } from "../src/core/services/WorkoutChecklistParser";
import { TrainingPlanIntentSchema } from "../src/core/schemas/training-plan";
import { ResolveTrainingPlanUseCase } from "../src/core/use-cases/ResolveTrainingPlanUseCase";
import { GetWorkoutChecklistUseCase, UpdateWorkoutTaskCompletionUseCase } from "../src/core/use-cases/WorkoutChecklistUseCases";
import { SearchExercisesUseCase } from "../src/core/use-cases/SearchExercisesUseCase";

const weekdays = {
  "Segunda-feira": "### Treino A\n- **Supino com halteres**: 3 séries de 8 a 10 repetições\n- **Exercício que não existe**: 2 séries de 10 repetições",
  "Terça-feira": "### Descanso\nDescanso programado",
  "Quarta-feira": "",
  "Quinta-feira": "",
  "Sexta-feira": "",
  "Sábado": "",
  "Domingo": ""
};

const analysis = AnalysisSchema.parse({
  id: "analysis-1",
  date: "2026-08-26",
  bloodTestFilename: "exam.pdf",
  biomarkers: [],
  healthStatus: "ok",
  supplementation: [],
  nutritionPlan: {
    "Segunda-feira": [], "Terça-feira": [], "Quarta-feira": [], "Quinta-feira": [],
    "Sexta-feira": [], "Sábado": [], "Domingo": []
  },
  trainingPlan: weekdays,
  deterministicAlerts: [],
  nutritionOrientation: "",
  trainingOrientation: "",
  createdAt: "2026-08-26T12:00:00.000Z"
});

const catalogExercise = {
  id: "0289",
  n: "dumbbell bench press",
  bp: "chest",
  tg: "pectorals",
  st: ["Lie on the bench.", "Press the dumbbells with control."],
  stPt: ["Deite-se no banco.", "Empurre os halteres com controle."]
} satisfies Exercise;

class FakeDatabase implements DatabasePort {
  completions: WorkoutTaskCompletion[] = [];

  constructor(private readonly analyses: Analysis[]) {}

  async getProfile(): Promise<Profile> { throw new Error("unused"); }
  async saveProfile(): Promise<void> { throw new Error("unused"); }
  async getSettings(): Promise<Settings> { throw new Error("unused"); }
  async saveSettings(): Promise<void> { throw new Error("unused"); }
  async getAnalyses(): Promise<Analysis[]> { return this.analyses; }
  async getBiomarkerHistory(): Promise<StructuredBiomarkerHistory[]> { throw new Error("unused"); }
  async saveAnalyses(): Promise<void> { throw new Error("unused"); }
  async getDocuments(): Promise<Document[]> { throw new Error("unused"); }
  async getWorkoutTaskCompletions(_userId: string, analysisId: string, weekday: Weekday): Promise<WorkoutTaskCompletion[]> {
    return this.completions.filter((completion) => completion.analysisId === analysisId && completion.weekday === weekday);
  }
  async saveWorkoutTaskCompletion(_userId: string, completion: WorkoutTaskCompletion): Promise<void> {
    this.completions = this.completions.filter((current) => !(current.analysisId === completion.analysisId
      && current.weekday === completion.weekday && current.taskKey === completion.taskKey));
    this.completions.push(completion);
  }
  async saveDocuments(): Promise<void> { throw new Error("unused"); }
  async updateAnalysisAnnotations(): Promise<Analysis | null> { throw new Error("unused"); }
  async saveProcessedBloodTest(): Promise<void> { throw new Error("unused"); }
  async saveProcessedBioimpedance(): Promise<void> { throw new Error("unused"); }
}

const catalog: ExerciseCatalogPort = {
  getExercises: async () => [catalogExercise],
  getAssetUrl: (_exercise, kind) => `/api/exercises/0289/media/${kind}`
};
const runtime: RuntimePort = {
  now: () => new Date("2026-08-26T13:00:00.000Z"),
  createId: (prefix) => `${prefix}id`
};

test("parser extracts exercise tasks and ignores rest metadata", () => {
  const parsed = parseWorkoutDay(weekdays["Segunda-feira"], "Segunda-feira");
  assert.equal(parsed.title, "Treino A");
  assert.equal(parsed.tasks.length, 2);
  assert.equal(parsed.tasks[0].sourceExerciseName, "Supino com halteres");
  assert.equal(parsed.tasks[0].prescription, "3 séries de 8 a 10 repetições");
  assert.equal(parseWorkoutDay(weekdays["Terça-feira"], "Terça-feira").isRestDay, true);
  const cardio = parseWorkoutDay("### HIIT\n- **Modalidade:** Bicicleta de Spinning.\n- **Aquecimento:** 5 minutos.", "Sábado");
  assert.equal(cardio.tasks.length, 1);
  assert.equal(cardio.tasks[0].sourceExerciseName, "bicicleta de spinning");
});

test("normalizer converts the generated training text into editable fields", () => {
  const parsed = parseTrainingDay(`### Treino B: Membros Inferiores (Ênfase em Proteção Articular)

- **Aquecimento:** 5 min de elíptico + mobilidade de quadril e tornozelo.
- **Leg Press 45°:** 4 séries de 10-12 repetições (controle a fase excêntrica, não estenda totalmente os joelhos no final).
- **Descanso:** 60 a 90 segundos entre as séries.`, "Quarta-feira");
  assert.equal(parsed.title, "Treino B: Membros Inferiores (Ênfase em Proteção Articular)");
  assert.equal(parsed.items.length, 3);
  assert.equal(parsed.items[0].kind, "warmup");
  assert.equal(parsed.items[0].duration, "5 min");
  assert.match(parsed.items[0].notes, /elíptico/);
  assert.equal(parsed.items[1].kind, "exercise");
  assert.equal(parsed.items[1].sets, 4);
  assert.equal(parsed.items[1].reps, "10-12");
  assert.match(parsed.items[1].notes, /fase excêntrica/);
  assert.equal(parsed.items[2].kind, "rest");
  assert.match(parsed.items[2].rest, /60 a 90 segundos/);
});

test("resolver returns only catalog exercises and never invents a fallback", () => {
  assert.equal(resolveExerciseName("Supino com halteres", [catalogExercise])?.id, "0289");
  assert.equal(resolveExerciseName("Exercício que não existe", [catalogExercise]), null);
});

test("generation resolver links structured intent to a canonical catalog id", async () => {
  const restDay = { title: "Descanso", message: "", isRestDay: true, items: [] };
  const intent = TrainingPlanIntentSchema.parse({
    "Segunda-feira": {
      title: "Treino A", message: "", isRestDay: false, items: [{
        id: "segunda-feira-1", kind: "exercise", name: "Supino reto com halteres",
        searchText: "Supino reto com halteres", aliases: ["dumbbell bench press"],
        bodyPart: "chest", target: "pectorals", equipment: "dumbbell",
        sets: 4, reps: "10-12", duration: "", rest: "90 s", notes: "", prescription: ""
      }]
    },
    "Terça-feira": restDay,
    "Quarta-feira": restDay,
    "Quinta-feira": restDay,
    "Sexta-feira": restDay,
    "Sábado": restDay,
    "Domingo": restDay
  });
  const resolved = await new ResolveTrainingPlanUseCase(catalog).execute({
    trainingPlan: weekdays,
    trainingPlanIntent: intent
  });
  assert.equal(resolved["Segunda-feira"].items[0]?.exerciseId, "0289");
  assert.equal(resolved["Segunda-feira"].items[0]?.prescription, "4 séries de 10-12 repetições Descanso: 90 s");
  assert.equal(resolved["Terça-feira"].items.length, 0);
});

test("generation resolver leaves ambiguous or unknown intent available for review", async () => {
  const restDay = { title: "Descanso", message: "", isRestDay: true, items: [] };
  const intent = TrainingPlanIntentSchema.parse(Object.fromEntries([
    ["Segunda-feira", { title: "Treino", message: "", isRestDay: false, items: [{ kind: "exercise", name: "Exercício que não existe", searchText: "Exercício que não existe" }] }],
    ...["Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"].map((day) => [day, restDay])
  ]));
  const resolved = await new ResolveTrainingPlanUseCase(catalog).execute({ trainingPlan: weekdays, trainingPlanIntent: intent });
  assert.equal(resolved["Segunda-feira"].items[0]?.exerciseId, null);
});

test("exercise search accepts Portuguese aliases and catalog instructions", async () => {
  const search = new SearchExercisesUseCase(catalog);
  const portuguese = await search.execute({ q: "Supino Reto com Halteres" });
  assert.equal(portuguese[0]?.id, "0289");
  assert.equal(portuguese[0]?.namePt, "supino reto com halteres");
  const instruction = await search.execute({ q: "Deite-se no banco" });
  assert.equal(instruction[0]?.id, "0289");
});

test("catalog resolves only the same exercise media assets", () => {
  const adapter = new JsonExerciseCatalogAdapter("unused", {
    image: "https://assets.example.test/images",
    animation: "https://assets.example.test/videos"
  });
  const exercise = { ...catalogExercise, img: "0289-preview.jpg", gif: "0289-preview.gif" };

  assert.equal(adapter.getAssetUrl(exercise, "image"), "https://assets.example.test/images/0289-preview.jpg");
  assert.equal(adapter.getAssetUrl(exercise, "animation"), "https://assets.example.test/videos/0289-preview.gif");
  assert.equal(adapter.getAssetUrl({ ...exercise, img: "../other.jpg" }, "image"), null);
});

test("catalog loads Portuguese instructions for every catalog exercise", async () => {
  const adapter = new JsonExerciseCatalogAdapter(
    "backend/data/exercises.json",
    {},
    "backend/data/exercise-instructions.pt-BR.json"
  );
  const exercises = await adapter.getExercises();
  assert.equal(exercises.length, 1324);
  assert.equal(exercises.every((exercise) => exercise.stPt?.length === exercise.st?.length), true);
  assert.match(exercises.find((exercise) => exercise.id === "0739")?.stPt?.[0] || "", /Ajuste o assento/);
});

test("checklist links matched tasks to catalog data and flags unknown tasks for review", async () => {
  const db = new FakeDatabase([analysis]);
  db.completions.push({
    analysisId: analysis.id,
    weekday: "Segunda-feira",
    taskKey: `${analysis.id}:Segunda-feira:1`,
    completed: true,
    completedAt: "2026-08-26T12:30:00.000Z"
  });
  const useCase = new GetWorkoutChecklistUseCase(db, catalog);
  const result = await useCase.execute("user-1", { analysisId: analysis.id, weekday: "Segunda-feira" });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.day.tasks[0].exerciseId, "0289");
  assert.equal(result.value.day.tasks[0].status, "completed");
  assert.equal(result.value.day.tasks[0].steps.length, 2);
  assert.equal(result.value.day.tasks[0].steps[0], "Deite-se no banco.");
  assert.equal(result.value.day.tasks[0].imageUrl, "/api/exercises/0289/media/image");
  assert.equal(result.value.day.tasks[0].animationUrl, "/api/exercises/0289/media/animation");
  assert.equal(result.value.day.tasks[1].exerciseId, null);
  assert.equal(result.value.day.tasks[1].status, "review");
});

test("checklist consumes structured training and uses stable item ids", async () => {
  const structuredAnalysis = AnalysisSchema.parse({
    ...analysis,
    trainingPlanStructured: {
      "Segunda-feira": { title: "Treino A", message: "", isRestDay: false, items: [{ id: "manual-press", kind: "exercise", name: "Supino com halteres", exerciseId: "0289", sets: 3, reps: "8-10", duration: "", rest: "90 s", notes: "", prescription: "3 séries de 8-10 repetições" }] },
      "Terça-feira": { title: "Descanso", message: "", isRestDay: true, items: [] },
      "Quarta-feira": { title: "Treino", message: "", isRestDay: false, items: [] },
      "Quinta-feira": { title: "Treino", message: "", isRestDay: false, items: [] },
      "Sexta-feira": { title: "Treino", message: "", isRestDay: false, items: [] },
      "Sábado": { title: "Treino", message: "", isRestDay: false, items: [] },
      "Domingo": { title: "Treino", message: "", isRestDay: false, items: [] }
    }
  });
  const db = new FakeDatabase([structuredAnalysis]);
  db.completions.push({ analysisId: analysis.id, weekday: "Segunda-feira", taskKey: `${analysis.id}:Segunda-feira:manual-press`, completed: true, completedAt: "2026-08-26T12:30:00.000Z" });
  const result = await new GetWorkoutChecklistUseCase(db, catalog).execute("user-1", { analysisId: analysis.id, weekday: "Segunda-feira" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.day.tasks[0].taskKey, "analysis-1:Segunda-feira:manual-press");
    assert.equal(result.value.day.tasks[0].status, "completed");
  }
});

test("completion update validates the task and persists only catalog-matched tasks", async () => {
  const db = new FakeDatabase([analysis]);
  const checklist = new GetWorkoutChecklistUseCase(db, catalog);
  const useCase = new UpdateWorkoutTaskCompletionUseCase(db, checklist, runtime);
  const result = await useCase.execute("user-1", {
    analysisId: analysis.id,
    weekday: "Segunda-feira",
    taskKey: `${analysis.id}:Segunda-feira:1`,
    completed: true
  });

  assert.equal(result.ok, true);
  assert.equal(db.completions[0]?.completedAt, "2026-08-26T13:00:00.000Z");
  const reviewResult = await useCase.execute("user-1", {
    analysisId: analysis.id,
    weekday: "Segunda-feira",
    taskKey: `${analysis.id}:Segunda-feira:2`,
    completed: true
  });
  assert.equal(reviewResult.ok, false);
  if (!reviewResult.ok) assert.equal(reviewResult.error.code, "WORKOUT_TASK_REQUIRES_REVIEW");
});
