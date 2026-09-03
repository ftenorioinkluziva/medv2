import { createHash } from "node:crypto";
import pg from "pg";
import { DatabasePort } from "../../core/ports/DatabasePort";
import { AnalysisConfiguration, AnalysisConfigurationPort, OpenRouterCredentialPort } from "../../core/ports/ConfigurationPort";
import { Analysis, AnalysisSchema, PlanContentSchema } from "../../core/schemas/analysis";
import { Document, DocumentSchema } from "../../core/schemas/document";
import { Profile, ProfileSchema } from "../../core/schemas/profile";
import { Settings, SettingsSchema } from "../../core/schemas/settings";
import { OperationFailure } from "../../core/types/errors";
import { getPool } from "./PostgresPool";
import { persistStructuredBiomarkers } from "./BiomarkerPersistence";
import { StructuredBiomarkerHistorySchemaArray } from "../../core/schemas/biomarker-history";
import { Weekday, WorkoutTaskCompletion, WorkoutTaskCompletionSchema } from "../../core/schemas/workout-checklist";

function persistenceError(message: string, cause: unknown): OperationFailure {
  return new OperationFailure({
    code: "PERSISTENCE_QUERY_FAILED",
    category: "internal",
    message,
    retryable: true
  }, { cause });
}

export class PostgresDatabaseAdapter implements DatabasePort, AnalysisConfigurationPort, OpenRouterCredentialPort {
  private readonly pool = getPool();

  private async queryAsUser<T extends pg.QueryResultRow = pg.QueryResultRow>(userId: string, text: string, values: unknown[] = []): Promise<pg.QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query("SELECT set_config('app.user_role', COALESCE((SELECT role FROM \"user\" WHERE id = $1), 'patient'), true)", [userId]);
      const result = await client.query<T>(text, values);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async getProfile(userId: string): Promise<Profile> {
    try {
      const result = await this.queryAsUser(userId, "SELECT payload FROM medv2_profile WHERE \"userId\" = $1", [userId]);
      return ProfileSchema.parse(result.rows[0]?.payload || {});
    } catch (error) { throw persistenceError("Não foi possível ler o perfil persistido.", error); }
  }

  async saveProfile(userId: string, profile: Profile): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO medv2_profile("userId", payload, "updatedAt") VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT ("userId") DO UPDATE SET payload = EXCLUDED.payload, "updatedAt" = NOW()
      `, [userId, JSON.stringify(ProfileSchema.parse(profile))]);
    } catch (error) { throw persistenceError("Não foi possível salvar o perfil.", error); }
  }

  async getSettings(userId: string): Promise<Settings> {
    try {
      const result = await this.queryAsUser(userId, "SELECT payload FROM medv2_settings WHERE \"userId\" = $1", [userId]);
      return SettingsSchema.parse({ ...(result.rows[0]?.payload || {}), openrouterApiKey: process.env.OPENROUTER_API_KEY || "" });
    } catch (error) { throw persistenceError("Não foi possível ler as configurações persistidas.", error); }
  }

  async saveSettings(userId: string, settings: Settings): Promise<void> {
    try {
      const { openrouterApiKey: _secret, ...safeSettings } = SettingsSchema.parse(settings);
      await this.pool.query(`
        INSERT INTO medv2_settings("userId", payload, "updatedAt") VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT ("userId") DO UPDATE SET payload = EXCLUDED.payload, "updatedAt" = NOW()
      `, [userId, JSON.stringify(safeSettings)]);
    } catch (error) { throw persistenceError("Não foi possível salvar as configurações.", error); }
  }

  async getAnalysisConfiguration(userId: string): Promise<AnalysisConfiguration> {
    const { openrouterApiKey: _secret, ...configuration } = await this.getSettings(userId);
    return configuration;
  }

  async getOpenRouterApiKey(_userId?: string): Promise<string> {
    return process.env.OPENROUTER_API_KEY || "";
  }

  async getAnalyses(userId: string): Promise<Analysis[]> {
    try {
      const result = await this.queryAsUser(userId, `
        SELECT a.payload, a."createdAt", published.payload AS "planPayload"
        FROM medv2_analysis a
        LEFT JOIN LATERAL (
          SELECT payload
          FROM medv2_plan_revision
          WHERE "userId" = a."userId" AND "analysisId" = a.id AND "analysisVersion" = a.version AND status = 'published'
          ORDER BY version DESC
          LIMIT 1
        ) published ON TRUE
        WHERE a."userId" = $1 AND a.status = 'completed'
        ORDER BY "createdAt" DESC
      `, [userId]);
      return AnalysisSchema.array().parse(result.rows.map((row) => {
        const analysis = AnalysisSchema.parse(row.payload);
        if (!row.planPayload) return analysis;
        return AnalysisSchema.parse({ ...analysis, ...PlanContentSchema.parse(row.planPayload) });
      }));
    } catch (error) { throw persistenceError("Não foi possível ler as análises persistidas.", error); }
  }

  async getBiomarkerHistory(userId: string) {
    try {
      const result = await this.queryAsUser(userId, `
        SELECT
          ab."analysisId" AS "analysisId",
          ab."analysisVersion" AS "analysisVersion",
          COALESCE(a.payload->>'date', '') AS date,
          bd.code AS "biomarkerCode",
          bd.canonical_name AS "biomarkerName",
          ab.value_numeric AS "valueNumeric",
          ab.value_text AS "valueText",
          ab.unit,
          ab.status,
          ab.reference_range_text AS "referenceRange",
          COALESCE(a.payload->>'annotations', '') AS annotations
        FROM medv2_analysis_biomarker ab
        JOIN medv2_biomarker_definition bd ON bd.id = ab."biomarkerId"
        JOIN medv2_analysis a ON a.id = ab."analysisId" AND a.version = ab."analysisVersion"
        WHERE ab."userId" = $1
        ORDER BY date DESC, ab."analysisId", bd.canonical_name
      `, [userId]);
      return StructuredBiomarkerHistorySchemaArray.parse(result.rows.map((row) => ({
        ...row,
        analysisVersion: Number(row.analysisVersion),
        valueNumeric: row.valueNumeric === null ? null : Number(row.valueNumeric)
      })));
    } catch (error) { throw persistenceError("Não foi possível ler o histórico estruturado de biomarcadores.", error); }
  }

  async saveAnalyses(userId: string, analyses: Analysis[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      for (const analysis of AnalysisSchema.array().parse(analyses)) {
        await client.query(`
          INSERT INTO medv2_analysis("id", "userId", version, payload, "createdAt")
          VALUES ($1, $2, 1, $3::jsonb, COALESCE(($3::jsonb->>'createdAt')::timestamptz, NOW()))
          ON CONFLICT ("id", version) DO UPDATE SET payload = EXCLUDED.payload
        `, [analysis.id, userId, JSON.stringify(analysis)]);
        await persistStructuredBiomarkers(client, userId, analysis);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw persistenceError("Não foi possível salvar as análises.", error);
    } finally { client.release(); }
  }

  async getDocuments(userId: string): Promise<Document[]> {
    try {
      const result = await this.queryAsUser(userId, `
      SELECT d.id, d.name, d.type, d.exam_date AS date, d.status, b."storageKey" AS filename,
               d."originalName", d."createdAt" AS "uploadedAt"
        FROM medv2_document d LEFT JOIN medv2_document_blob b ON b."documentId" = d.id
        WHERE d."userId" = $1 ORDER BY d.exam_date DESC, d."createdAt" DESC
      `, [userId]);
      return DocumentSchema.array().parse(result.rows.map((row) => ({
        ...row,
        date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
        uploadedAt: row.uploadedAt instanceof Date ? row.uploadedAt.toISOString() : row.uploadedAt
      })));
    } catch (error) { throw persistenceError("Não foi possível ler os documentos persistidos.", error); }
  }

  async getWorkoutTaskCompletions(userId: string, analysisId: string, weekday: Weekday): Promise<WorkoutTaskCompletion[]> {
    try {
      const result = await this.queryAsUser(userId, `
        SELECT "analysisId", weekday, "taskKey", completed, "completedAt"
        FROM medv2_workout_task_completion
        WHERE "userId" = $1 AND "analysisId" = $2 AND weekday = $3
      `, [userId, analysisId, weekday]);
      return WorkoutTaskCompletionSchema.array().parse(result.rows.map((row) => ({
        analysisId: row.analysisId,
        weekday: row.weekday,
        taskKey: row.taskKey,
        completed: row.completed,
        completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt
      })));
    } catch (error) { throw persistenceError("Não foi possível ler o progresso do treino.", error); }
  }

  async saveWorkoutTaskCompletion(userId: string, completion: WorkoutTaskCompletion): Promise<void> {
    try {
      const parsed = WorkoutTaskCompletionSchema.parse(completion);
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        await client.query(`
          INSERT INTO medv2_workout_task_completion(
            "userId", "analysisId", weekday, "taskKey", completed, "completedAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT ("userId", "analysisId", weekday, "taskKey") DO UPDATE SET
            completed = EXCLUDED.completed,
            "completedAt" = EXCLUDED."completedAt",
            "updatedAt" = NOW()
        `, [userId, parsed.analysisId, parsed.weekday, parsed.taskKey, parsed.completed, parsed.completedAt]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally { client.release(); }
    } catch (error) { throw persistenceError("Não foi possível salvar o progresso do treino.", error); }
  }

  async saveDocuments(userId: string, documents: Document[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      for (const document of DocumentSchema.array().parse(documents)) {
        await client.query(`
          INSERT INTO medv2_document(id, "userId", name, type, exam_date, status, "originalName", "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, name = EXCLUDED.name
        `, [document.id, userId, document.name, document.type, document.date, document.status, document.originalName, document.uploadedAt]);
        await client.query(`
          INSERT INTO medv2_document_blob("documentId", "storageKey", sha256, size_bytes, mime_type, status)
          VALUES ($1, $2, $3, $4, $5, 'available')
          ON CONFLICT ("documentId") DO UPDATE SET "storageKey" = EXCLUDED."storageKey", status = 'available'
        `, [document.id, document.filename, document.sha256 || createHash("sha256").update(document.filename).digest("hex"), document.sizeBytes || 0, document.mimeType]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw persistenceError("Não foi possível salvar os documentos.", error);
    } finally { client.release(); }
  }

  async updateAnalysisAnnotations(userId: string, id: string, annotations: string): Promise<Analysis | null> {
    const result = await this.queryAsUser(userId, `
      SELECT payload, version FROM medv2_analysis WHERE "userId" = $1 AND id = $2 ORDER BY version DESC LIMIT 1
    `, [userId, id]);
    if (!result.rows[0]) return null;
    const analysis = AnalysisSchema.parse({ ...result.rows[0].payload, annotations });
    await this.queryAsUser(userId, `
      UPDATE medv2_analysis SET payload = $3::jsonb WHERE "userId" = $1 AND id = $2 AND version = $4
    `, [userId, id, JSON.stringify(analysis), result.rows[0].version]);
    return analysis;
  }

  async saveProcessedBloodTest(userId: string, analysis: Analysis, document: Document): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query(`
        INSERT INTO medv2_document(id, "userId", name, type, exam_date, status, "originalName", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
      `, [document.id, userId, document.name, document.type, document.date, document.status, document.originalName, document.uploadedAt]);
      await client.query(`
        INSERT INTO medv2_document_blob("documentId", "storageKey", sha256, size_bytes, mime_type, status)
        VALUES ($1, $2, $3, $4, $5, 'available')
        ON CONFLICT ("documentId") DO UPDATE SET "storageKey" = EXCLUDED."storageKey", status = 'available'
      `, [document.id, document.filename, document.sha256 || createHash("sha256").update(document.filename).digest("hex"), document.sizeBytes || 0, document.mimeType]);
      await client.query(`
        INSERT INTO medv2_analysis(id, "userId", "documentId", version, input_fingerprint, payload, "createdAt")
        VALUES ($1, $2, $3, 1, $4, $5::jsonb, $6)
        ON CONFLICT (id, version) DO UPDATE SET payload = EXCLUDED.payload, "documentId" = EXCLUDED."documentId"
      `, [analysis.id, userId, document.id, createHash("sha256").update(JSON.stringify(analysis)).digest("hex"), JSON.stringify(analysis), analysis.createdAt]);
      await persistStructuredBiomarkers(client, userId, analysis);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw persistenceError("Não foi possível salvar documento e análise.", error);
    } finally { client.release(); }
  }

  async saveProcessedBioimpedance(userId: string, profile: Profile, document: Document): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
      await client.query(`
        INSERT INTO medv2_profile("userId", payload, "updatedAt") VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT ("userId") DO UPDATE SET payload = EXCLUDED.payload, "updatedAt" = NOW()
      `, [userId, JSON.stringify(ProfileSchema.parse(profile))]);
      await client.query(`
        INSERT INTO medv2_document(id, "userId", name, type, exam_date, status, "originalName", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
      `, [document.id, userId, document.name, document.type, document.date, document.status, document.originalName, document.uploadedAt]);
      await client.query(`
        INSERT INTO medv2_document_blob("documentId", "storageKey", sha256, size_bytes, mime_type, status)
        VALUES ($1, $2, $3, $4, $5, 'available')
        ON CONFLICT ("documentId") DO UPDATE SET "storageKey" = EXCLUDED."storageKey", status = 'available'
      `, [document.id, document.filename, document.sha256 || createHash("sha256").update(document.filename).digest("hex"), document.sizeBytes || 0, document.mimeType]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw persistenceError("Não foi possível salvar bioimpedância e perfil.", error);
    } finally { client.release(); }
  }
}
