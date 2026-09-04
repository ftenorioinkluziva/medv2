import crypto from "crypto";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { getPool } from "./adapters/database/PostgresPool";
import { PostgresDatabaseAdapter } from "./adapters/database/PostgresDatabaseAdapter";
import { PostgresBackofficePlanAdapter } from "./adapters/database/PostgresBackofficePlanAdapter";
import { PostgresExerciseCatalogAdapter } from "./adapters/exercise/PostgresExerciseCatalogAdapter";
import { JsonKnowledgeBaseAdapter } from "./adapters/knowledge/JsonKnowledgeBaseAdapter";
import { DEFAULT_OPENROUTER_TIMEOUT_MS, OpenRouterAdapter } from "./adapters/llm/OpenRouterAdapter";
import { PdfParseAdapter } from "./adapters/pdf/PdfParseAdapter";
import { SystemRuntimeAdapter } from "./adapters/runtime/SystemRuntimeAdapter";
import { LocalFileStorageAdapter } from "./adapters/storage/LocalFileStorageAdapter";
import {
  AnnotationUpdateSchema,
  DocumentTypeSchema,
  ExerciseQuerySchema,
  ExerciseMediaRequestSchema,
  ResourceIdSchema,
  SettingsUpdateSchema
} from "./core/schemas/operations";
import { ProfileSchema } from "./core/schemas/profile";
import { WorkoutChecklistQuerySchema, WorkoutTaskCompletionUpdateSchema } from "./core/schemas/workout-checklist";
import { UserRoleSchema } from "./core/schemas/backoffice";
import { OperationError, OperationFailure, toOperationError } from "./core/types/errors";
import {
  GetAnalysesUseCase,
  GetAnalysisByIdUseCase,
  GetBiomarkerHistoryUseCase,
  GetDocumentsUseCase,
  GetProfileUseCase,
  GetSettingsUseCase,
  SaveProfileUseCase,
  UpdateAnalysisAnnotationsUseCase,
  UpdateSettingsUseCase
} from "./core/use-cases/CrudUseCases";
import { GenerateAnalysisUseCase } from "./core/use-cases/GenerateAnalysisUseCase";
import { ResolveTrainingPlanUseCase } from "./core/use-cases/ResolveTrainingPlanUseCase";
import { GetDocumentFileUseCase } from "./core/use-cases/GetDocumentFileUseCase";
import { ParseDocumentUseCase } from "./core/use-cases/ParseDocumentUseCase";
import { ProcessDocumentUseCase } from "./core/use-cases/ProcessDocumentUseCase";
import { SearchExercisesUseCase } from "./core/use-cases/SearchExercisesUseCase";
import { GetExerciseMediaUseCase } from "./core/use-cases/GetExerciseMediaUseCase";
import { GetWorkoutChecklistUseCase, UpdateWorkoutTaskCompletionUseCase } from "./core/use-cases/WorkoutChecklistUseCases";
import {
  GetBackofficePlanEditorUseCase,
  ListBackofficePatientsUseCase,
  PublishBackofficePlanUseCase,
  SaveBackofficePlanDraftUseCase
} from "./core/use-cases/BackofficePlanUseCases";
import { BackofficePlanInputSchema } from "./core/schemas/backoffice";
import { AuthContext } from "./core/auth-context";
import { IdempotencyKeySchema } from "./core/schemas/auth";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const HOST = resolveHost();
export function resolveOpenRouterTimeout(environment: NodeJS.ProcessEnv = process.env): number {
  const rawValue = environment.OPENROUTER_TIMEOUT_MS?.trim();
  if (!rawValue) return DEFAULT_OPENROUTER_TIMEOUT_MS;

  const timeoutMs = Number(rawValue);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("OPENROUTER_TIMEOUT_MS deve ser um inteiro positivo em milissegundos.");
  }
  return timeoutMs;
}

const OPENROUTER_TIMEOUT_MS = resolveOpenRouterTimeout();
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const FRONTEND_DIR = path.join(ROOT, "frontend", "dist");
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const TRUSTED_ORIGINS = new Set((process.env.BETTER_AUTH_TRUSTED_ORIGINS || process.env.BETTER_AUTH_URL || "")
  .split(",").map((origin) => origin.trim()).filter(Boolean));

export function resolveHost(environment: NodeJS.ProcessEnv = process.env): string {
  const requested = environment.HOST || "127.0.0.1";
  if (requested === "127.0.0.1" || requested === "localhost") return requested;
  if (requested === "0.0.0.0" && environment.MEDV2_CONTAINER === "true") return requested;
  throw new Error("HOST não seguro. Use loopback local ou MEDV2_CONTAINER=true dentro do container.");
}

function operationErrorFrom(error: unknown): OperationError {
  if (error instanceof ZodError) return {
    code: "INVALID_INPUT",
    category: "validation",
    message: "A entrada enviada é inválida.",
    hint: "Revise os campos indicados e tente novamente.",
    retryable: false,
    invalidFields: error.issues.map((issue) => issue.path.join(".")).filter(Boolean)
  };
  return toOperationError(error, {
    code: "INTERNAL_ERROR",
    category: "internal",
    message: "Erro interno do servidor.",
    retryable: false
  });
}

function statusFor(error: OperationError): number {
  if (error.code.endsWith("_NOT_FOUND")) return 404;
  if (error.code === "UNAUTHORIZED") return 401;
  return ({ validation: 400, authorization: 403, conflict: 409, rate_limit: 429, upstream: 502, internal: 500 })[error.category];
}

function sendError(res: Response, error: unknown): Response {
  const operationError = operationErrorFrom(error);
  console.error("[operation-error]", {
    requestId: res.getHeader("X-Request-Id"),
    code: operationError.code,
    category: operationError.category,
    retryable: operationError.retryable
  });
  return res.status(statusFor(operationError)).json({ success: false, error: operationError });
}

type AuthenticatedRequest = Request & { authContext?: AuthContext };

async function loadAuthContext(request: Request): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session?.user || !session.session) return null;
  const roleResult = await getPool().query("SELECT role FROM \"user\" WHERE id = $1", [session.user.id]);
  const role = UserRoleSchema.parse(roleResult.rows[0]?.role || "patient");
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    sessionId: session.session.id,
    role
  };
}

function requireProfessional(request: Request, response: Response, next: NextFunction): void {
  const context = (request as AuthenticatedRequest).authContext;
  if (context?.role !== "professional") {
    sendError(response, {
      code: "PROFESSIONAL_REQUIRED",
      category: "authorization",
      message: "Acesso restrito a profissionais.",
      retryable: false
    });
    return;
  }
  next();
}

function requireSession(request: Request, response: Response, next: NextFunction): void {
  loadAuthContext(request).then((context) => {
    if (!context) {
      sendError(response, {
        code: "UNAUTHORIZED",
        category: "authorization",
        message: "É necessário iniciar sessão.",
        retryable: false
      });
      return;
    }
    (request as AuthenticatedRequest).authContext = context;
    next();
  }).catch((error) => sendError(response, error));
}

function userId(request: Request): string {
  const context = (request as AuthenticatedRequest).authContext;
  if (!context) throw new OperationFailure({
    code: "UNAUTHORIZED",
    category: "authorization",
    message: "É necessário iniciar sessão.",
    retryable: false
  });
  return context.userId;
}

async function startOperation(ownerId: string, key: string, fingerprint: string): Promise<{ status: string; result?: unknown }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [ownerId]);
    const inserted = await client.query(`
      INSERT INTO medv2_operation("userId", "idempotencyKey", fingerprint, status, attempt)
      VALUES ($1, $2, $3, 'processing', 1)
      ON CONFLICT ("userId", "idempotencyKey") DO NOTHING
      RETURNING status, result
    `, [ownerId, key, fingerprint]);
    if (inserted.rowCount) {
      await client.query("COMMIT");
      return inserted.rows[0];
    }
    const existing = await client.query(`SELECT fingerprint, status, result FROM medv2_operation WHERE "userId" = $1 AND "idempotencyKey" = $2`, [ownerId, key]);
    await client.query("COMMIT");
    const row = existing.rows[0];
    if (!row) throw new OperationFailure({ code: "OPERATION_NOT_FOUND", category: "internal", message: "Operação não encontrada.", retryable: true });
    if (row.fingerprint !== fingerprint) throw new OperationFailure({ code: "IDEMPOTENCY_KEY_REUSED", category: "conflict", message: "A chave de idempotência foi usada com outro conteúdo.", retryable: false });
    if (row.status === "completed") return row;
    throw new OperationFailure({ code: "OPERATION_IN_PROGRESS", category: "conflict", message: "Este documento já está sendo processado.", retryable: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

async function finishOperation(ownerId: string, key: string, result: unknown): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [ownerId]);
    await client.query(`UPDATE medv2_operation SET status = 'completed', result = $3::jsonb, "updatedAt" = NOW() WHERE "userId" = $1 AND "idempotencyKey" = $2`, [ownerId, key, JSON.stringify(result)]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
}

async function failOperation(ownerId: string, key: string, error: unknown): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [ownerId]);
    await client.query(`UPDATE medv2_operation SET status = 'failed', error = $3::jsonb, "updatedAt" = NOW() WHERE "userId" = $1 AND "idempotencyKey" = $2`, [ownerId, key, JSON.stringify(error)]);
    await client.query("COMMIT");
  } catch (failure) { await client.query("ROLLBACK").catch(() => undefined); throw failure; }
  finally { client.release(); }
}

export function createApp() {
  const app = express();
  const db = new PostgresDatabaseAdapter();
  const runtime = new SystemRuntimeAdapter();
  const files = new LocalFileStorageAdapter(UPLOADS_DIR);
  const llm = new OpenRouterAdapter(db, { timeoutMs: OPENROUTER_TIMEOUT_MS });
  const parser = new ParseDocumentUseCase(new PdfParseAdapter(), llm, db);
  const exerciseCatalog = new PostgresExerciseCatalogAdapter();
  const resolveTrainingPlan = new ResolveTrainingPlanUseCase(exerciseCatalog);
  const analysisGenerator = new GenerateAnalysisUseCase(llm, db, db, new JsonKnowledgeBaseAdapter(DATA_DIR), runtime, resolveTrainingPlan);
  const processDocument = new ProcessDocumentUseCase(parser, analysisGenerator, db, files, runtime);
  const getProfile = new GetProfileUseCase(db);
  const saveProfile = new SaveProfileUseCase(db);
  const getSettings = new GetSettingsUseCase(db);
  const updateSettings = new UpdateSettingsUseCase(db);
  const getAnalyses = new GetAnalysesUseCase(db);
  const getBiomarkerHistory = new GetBiomarkerHistoryUseCase(db);
  const getAnalysisById = new GetAnalysisByIdUseCase(db);
  const getDocuments = new GetDocumentsUseCase(db);
  const updateAnnotations = new UpdateAnalysisAnnotationsUseCase(db);
  const searchExercises = new SearchExercisesUseCase(exerciseCatalog);
  const getExerciseMedia = new GetExerciseMediaUseCase(exerciseCatalog);
  const getWorkoutChecklist = new GetWorkoutChecklistUseCase(db, exerciseCatalog);
  const updateWorkoutTaskCompletion = new UpdateWorkoutTaskCompletionUseCase(db, getWorkoutChecklist, runtime);
  const getDocumentFile = new GetDocumentFileUseCase(db, files);
  const backofficePlans = new PostgresBackofficePlanAdapter();
  const listBackofficePatients = new ListBackofficePatientsUseCase(backofficePlans);
  const getBackofficePlanEditor = new GetBackofficePlanEditorUseCase(backofficePlans);
  const saveBackofficePlanDraft = new SaveBackofficePlanDraftUseCase(backofficePlans);
  const publishBackofficePlan = new PublishBackofficePlanUseCase(backofficePlans);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_BYTES, files: 1 },
    fileFilter: (_request, file, callback) => {
      callback(null, file.mimetype === "application/pdf");
    }
  });

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const requestId = request.header("X-Request-Id") || crypto.randomUUID();
    response.setHeader("X-Request-Id", requestId);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(cors({
    origin: (origin, callback) => {
      const allowed = !origin || TRUSTED_ORIGINS.has(origin) || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`;
      callback(allowed ? null : new OperationFailure({
        code: "ORIGIN_NOT_ALLOWED",
        category: "authorization",
        message: "Origem não autorizada.",
        retryable: false
      }), allowed);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"]
  }));
  app.all("/api/auth/*", toNodeHandler(auth));
  app.get("/api/health", async (_request, response) => {
    try {
      await getPool().query("SELECT 1");
      response.json({ success: true, status: "ok", db: "connected" });
    } catch {
      response.status(503).json({ success: false, status: "degraded", db: "unavailable" });
    }
  });
  app.use(express.json({ limit: "256kb" }));
  app.use(express.static(FRONTEND_DIR));

  app.get("/api/me", requireSession, async (request, response) => {
    const context = (request as AuthenticatedRequest).authContext;
    response.json({ success: true, user: context });
  });

  app.get("/api/settings", requireSession, async (request, response) => {
    try {
      const settings = await getSettings.execute(userId(request));
      response.json({ success: true, settings: {
        openrouterApiKey: settings.openrouterApiKey ? `${"•".repeat(12)}${settings.openrouterApiKey.slice(-4)}` : "",
        hasKey: Boolean(settings.openrouterApiKey),
        modelExtraction: settings.modelExtraction,
        modelAnalysis: settings.modelAnalysis,
        lens: settings.lens,
        lensLongevidade: settings.lensLongevidade,
        lensConvencional: settings.lensConvencional,
        lensPerformance: settings.lensPerformance
      } });
    } catch (error) { sendError(response, error); }
  });

  app.post("/api/settings", requireSession, async (request, response) => {
    try {
      await updateSettings.execute(userId(request), SettingsUpdateSchema.parse(request.body));
      response.json({ success: true, message: "Configurações salvas com sucesso!" });
    } catch (error) { sendError(response, error); }
  });

  app.get("/api/profile", requireSession, async (request, response) => {
    try { response.json({ success: true, profile: await getProfile.execute(userId(request)) }); }
    catch (error) { sendError(response, error); }
  });

  app.post("/api/profile", requireSession, async (request, response) => {
    try {
      const profile = ProfileSchema.parse(request.body);
      await saveProfile.execute(userId(request), profile);
      response.json({ success: true, message: "Perfil atualizado com sucesso!", profile });
    } catch (error) { sendError(response, error); }
  });

  app.get("/api/exercises", async (request, response) => {
    try { response.json({ success: true, exercises: await searchExercises.execute(ExerciseQuerySchema.parse(request.query)) }); }
    catch (error) { sendError(response, error); }
  });

  app.get("/api/exercises/:exerciseId/media/:kind", async (request, response) => {
    try {
      const result = await getExerciseMedia.execute(ExerciseMediaRequestSchema.parse(request.params));
      if (!result.ok) return sendError(response, result.error);
      response.setHeader("Content-Type", result.value.mimeType);
      response.setHeader("Content-Length", String(result.value.sizeBytes));
      response.setHeader("Cache-Control", "public, max-age=86400, immutable");
      response.send(result.value.contents);
    } catch (error) { sendError(response, error); }
  });

  app.get("/api/workout/checklist", requireSession, async (request, response) => {
    try {
      const result = await getWorkoutChecklist.execute(userId(request), WorkoutChecklistQuerySchema.parse({
        analysisId: typeof request.query.analysisId === "string" ? request.query.analysisId : undefined,
        weekday: request.query.weekday
      }));
      if (!result.ok) return sendError(response, result.error);
      response.json({ success: true, checklist: result.value });
    } catch (error) { sendError(response, error); }
  });

  app.post("/api/workout/checklist/completion", requireSession, async (request, response) => {
    try {
      const result = await updateWorkoutTaskCompletion.execute(userId(request), WorkoutTaskCompletionUpdateSchema.parse(request.body));
      if (!result.ok) return sendError(response, result.error);
      response.json({ success: true, completion: result.value });
    } catch (error) { sendError(response, error); }
  });

  app.get("/api/backoffice/patients", requireSession, requireProfessional, async (request, response) => {
    try { response.json({ success: true, patients: await listBackofficePatients.execute(userId(request)) }); }
    catch (error) { sendError(response, error); }
  });

  app.get("/api/backoffice/patients/:patientId/analyses/:analysisId/plan", requireSession, requireProfessional, async (request, response) => {
    try {
      const input = BackofficePlanInputSchema.parse({ patientId: request.params.patientId, analysisId: request.params.analysisId });
      const editor = await getBackofficePlanEditor.execute(userId(request), input);
      if (!editor) return sendError(response, { code: "PLAN_CONTEXT_NOT_FOUND", category: "validation", message: "Paciente ou análise não encontrada.", retryable: false });
      response.json({ success: true, editor });
    } catch (error) { sendError(response, error); }
  });

  app.put("/api/backoffice/patients/:patientId/analyses/:analysisId/plan", requireSession, requireProfessional, async (request, response) => {
    try {
      const result = await saveBackofficePlanDraft.execute(userId(request), {
        patientId: request.params.patientId,
        analysisId: request.params.analysisId,
        content: request.body?.content
      });
      if (!result.ok) return sendError(response, result.error);
      response.json({ success: true, revision: result.value, message: "Rascunho salvo com sucesso." });
    } catch (error) { sendError(response, error); }
  });

  app.post("/api/backoffice/patients/:patientId/analyses/:analysisId/plan/publish", requireSession, requireProfessional, async (request, response) => {
    try {
      const input = BackofficePlanInputSchema.parse({ patientId: request.params.patientId, analysisId: request.params.analysisId });
      const result = await publishBackofficePlan.execute(userId(request), input);
      if (!result.ok) return sendError(response, result.error);
      response.json({ success: true, revision: result.value, message: "Plano publicado com sucesso." });
    } catch (error) { sendError(response, error); }
  });

  app.get("/api/documents", requireSession, async (request, response) => {
    try { response.json({ success: true, documents: await getDocuments.execute(userId(request)) }); }
    catch (error) { sendError(response, error); }
  });

  app.get("/api/documents/:id/file", requireSession, async (request, response) => {
    try {
      const result = await getDocumentFile.execute(userId(request), ResourceIdSchema.parse(request.params.id));
      if (!result.ok) return sendError(response, result.error);
      response.type("application/pdf").attachment(result.value.filename).send(result.value.contents);
    } catch (error) { sendError(response, error); }
  });

  app.get("/api/analyses", requireSession, async (request, response) => {
    try { response.json({ success: true, analyses: await getAnalyses.execute(userId(request)) }); }
    catch (error) { sendError(response, error); }
  });

  app.get("/api/biomarkers/history", requireSession, async (request, response) => {
    try { response.json({ success: true, biomarkers: await getBiomarkerHistory.execute(userId(request)) }); }
    catch (error) { sendError(response, error); }
  });

  app.get("/api/analyses/:id", requireSession, async (request, response) => {
    try {
      const analysis = await getAnalysisById.execute(userId(request), ResourceIdSchema.parse(request.params.id));
      if (!analysis) return sendError(response, { code: "ANALYSIS_NOT_FOUND", category: "validation", message: "Análise não encontrada.", retryable: false });
      response.json({ success: true, analysis });
    } catch (error) { sendError(response, error); }
  });

  app.post("/api/analyses/:id/annotations", requireSession, async (request, response) => {
    try {
      const id = ResourceIdSchema.parse(request.params.id);
      const input = AnnotationUpdateSchema.parse(request.body);
      const analysis = await updateAnnotations.execute(userId(request), id, input.annotations);
      if (!analysis) return sendError(response, { code: "ANALYSIS_NOT_FOUND", category: "validation", message: "Análise não encontrada.", retryable: false });
      response.json({ success: true, message: "Anotações salvas com sucesso!", analysis });
    } catch (error) { sendError(response, error); }
  });

  app.post("/api/upload-document", requireSession, upload.single("pdf"), async (request, response) => {
    try {
      if (!request.file) throw new OperationFailure({ code: "PDF_REQUIRED", category: "validation", message: "Envie um arquivo PDF válido.", retryable: false });
      if (request.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new OperationFailure({ code: "INVALID_PDF_SIGNATURE", category: "validation", message: "O arquivo enviado não possui assinatura PDF válida.", retryable: false });
      }
      const ownerId = userId(request);
      const idempotencyKey = IdempotencyKeySchema.parse(request.header("Idempotency-Key"));
      const fingerprint = crypto.createHash("sha256").update(request.file.buffer).update(String(request.body.docType || "")).digest("hex");
      const operation = await startOperation(ownerId, idempotencyKey, fingerprint);
      if (operation.status === "completed") return response.json(operation.result);
      const result = await processDocument.execute(ownerId, {
        type: DocumentTypeSchema.parse(request.body.docType),
        originalName: path.basename(request.file.originalname).slice(0, 255),
        contents: request.file.buffer
      });
      if (!result.ok) {
        await failOperation(ownerId, idempotencyKey, result.error);
        return sendError(response, result.error);
      }
      const output = { success: true, ...result.value };
      await finishOperation(ownerId, idempotencyKey, output);
      response.json(output);
    } catch (error) { sendError(response, error); }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      return sendError(response, {
        code: error.code === "LIMIT_FILE_SIZE" ? "PDF_TOO_LARGE" : "UPLOAD_REJECTED",
        category: "validation",
        message: error.code === "LIMIT_FILE_SIZE" ? "O PDF excede o limite de 15 MB." : "O upload foi rejeitado.",
        retryable: false
      });
    }
    return sendError(response, error);
  });

  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, HOST, () => {
    console.log(`MedV2 Analyzer Server rodando em http://${HOST}:${PORT}`);
  });
}
