import crypto from "node:crypto";
import pg from "pg";
import { BackofficePlanPort } from "../../core/ports/BackofficePlanPort";
import {
  BackofficePatientSchema,
  BackofficePlanEditor,
  BackofficePlanInput,
  BackofficePlanEditorSchema,
  BackofficePatient,
  PlanRevision,
  PlanRevisionSchema,
  SavePlanDraftInput,
  planContentFromAnalysis,
  ensureStructuredPlanContent
} from "../../core/schemas/backoffice";
import { AnalysisSchema } from "../../core/schemas/analysis";
import { OperationFailure } from "../../core/types/errors";
import { getPool } from "./PostgresPool";

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

export class PostgresBackofficePlanAdapter implements BackofficePlanPort {
  private readonly pool = getPool();

  private async withProfessional<T>(actorId: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [actorId]);
      await client.query("SELECT set_config('app.user_role', 'professional', true)");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  private revision(row: Record<string, unknown>): PlanRevision {
    return PlanRevisionSchema.parse({
      id: row.id,
      patientId: row.patientId,
      analysisId: row.analysisId,
      analysisVersion: Number(row.analysisVersion),
      version: Number(row.version),
      status: row.status,
      source: row.source,
      content: ensureStructuredPlanContent(row.payload),
      createdBy: row.createdBy,
      publishedBy: row.publishedBy,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
      publishedAt: row.publishedAt ? iso(row.publishedAt) : null
    });
  }

  async listPatients(actorId: string): Promise<BackofficePatient[]> {
    return this.withProfessional(actorId, async (client) => {
      const result = await client.query(`
        SELECT
          u.id,
          u.name,
          u.email,
          COALESCE(json_agg(json_build_object(
            'id', a.id,
            'date', COALESCE(a.payload->>'date', ''),
            'bloodTestFilename', COALESCE(a.payload->>'bloodTestFilename', ''),
            'createdAt', a."createdAt"
          ) ORDER BY a."createdAt" DESC) FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS analyses
        FROM "user" u
        LEFT JOIN medv2_analysis a ON a."userId" = u.id AND a.status = 'completed'
        WHERE (u.role = 'patient' OR u.id = $1)
        GROUP BY u.id, u.name, u.email
        HAVING COUNT(a.id) > 0 OR u.id = $1
        ORDER BY u.name ASC, u.email ASC
      `, [actorId]);
      return BackofficePatientSchema.array().parse(result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        analyses: (row.analyses as Array<Record<string, unknown>>).map((analysis) => ({
          ...analysis,
          createdAt: iso(analysis.createdAt)
        }))
      })));
    });
  }

  async getEditor(actorId: string, input: BackofficePlanInput): Promise<BackofficePlanEditor | null> {
    return this.withProfessional(actorId, async (client) => {
      const patientResult = await client.query(`SELECT id, name, email FROM "user" WHERE id = $1 AND (role = 'patient' OR id = $2)`, [input.patientId, actorId]);
      const analysisResult = await client.query(`
        SELECT id, version, payload, "createdAt"
        FROM medv2_analysis
        WHERE "userId" = $1 AND id = $2 AND status = 'completed'
        ORDER BY version DESC LIMIT 1
      `, [input.patientId, input.analysisId]);
      if (!patientResult.rows[0] || !analysisResult.rows[0]) return null;

      const revisionsResult = await client.query(`
        SELECT id, "userId" AS "patientId", "analysisId", "analysisVersion", version, status, source,
               payload, "createdBy", "publishedBy", "createdAt", "updatedAt", "publishedAt"
        FROM medv2_plan_revision
        WHERE "userId" = $1 AND "analysisId" = $2 AND "analysisVersion" = $3
        ORDER BY version DESC
      `, [input.patientId, input.analysisId, analysisResult.rows[0].version]);
      const revisions = revisionsResult.rows.map((row) => this.revision(row));
      const analysis = AnalysisSchema.parse(analysisResult.rows[0].payload);
      return BackofficePlanEditorSchema.parse({
        patient: patientResult.rows[0],
        analysis: {
          id: analysis.id,
          date: analysis.date,
          bloodTestFilename: analysis.bloodTestFilename,
          createdAt: iso(analysisResult.rows[0].createdAt)
        },
        generated: planContentFromAnalysis(analysis),
        published: revisions.find((revision) => revision.status === "published") || null,
        draft: revisions.find((revision) => revision.status === "draft") || null,
        history: revisions
      });
    });
  }

  async saveDraft(actorId: string, input: SavePlanDraftInput): Promise<PlanRevision> {
    return this.withProfessional(actorId, async (client) => {
      const lockKey = `${input.patientId}:${input.analysisId}`;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);
      const analysis = await client.query(`
        SELECT version FROM medv2_analysis
        WHERE "userId" = $1 AND id = $2 AND status = 'completed'
        ORDER BY version DESC LIMIT 1
      `, [input.patientId, input.analysisId]);
      if (!analysis.rows[0]) throw new OperationFailure({
        code: "ANALYSIS_NOT_FOUND", category: "validation", message: "A análise selecionada não foi encontrada.", retryable: false
      });

      const existing = await client.query(`
        SELECT id, "userId" AS "patientId", "analysisId", "analysisVersion", version, status, source,
               payload, "createdBy", "publishedBy", "createdAt", "updatedAt", "publishedAt"
        FROM medv2_plan_revision
        WHERE "userId" = $1 AND "analysisId" = $2 AND "analysisVersion" = $3 AND status = 'draft'
        ORDER BY version DESC LIMIT 1
      `, [input.patientId, input.analysisId, analysis.rows[0].version]);
      const result = existing.rows[0]
        ? await client.query(`
            UPDATE medv2_plan_revision
            SET payload = $2::jsonb, "updatedAt" = NOW()
            WHERE id = $1
            RETURNING id, "userId" AS "patientId", "analysisId", "analysisVersion", version, status, source,
                      payload, "createdBy", "publishedBy", "createdAt", "updatedAt", "publishedAt"
          `, [existing.rows[0].id, JSON.stringify(input.content)])
        : await client.query(`
            INSERT INTO medv2_plan_revision(
              id, "userId", "analysisId", "analysisVersion", version, status, source, payload, "createdBy"
            )
            VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(version), 0) + 1 FROM medv2_plan_revision WHERE "userId" = $2 AND "analysisId" = $3 AND "analysisVersion" = $4), 'draft', 'manual', $5::jsonb, $6)
            RETURNING id, "userId" AS "patientId", "analysisId", "analysisVersion", version, status, source,
                      payload, "createdBy", "publishedBy", "createdAt", "updatedAt", "publishedAt"
          `, [`plan_${crypto.randomUUID()}`, input.patientId, input.analysisId, analysis.rows[0].version, JSON.stringify(input.content), actorId]);
      const revision = this.revision(result.rows[0]);
      await this.audit(client, actorId, input.patientId, "plan.draft_saved", revision);
      return revision;
    });
  }

  async publishDraft(actorId: string, input: BackofficePlanInput): Promise<PlanRevision | null> {
    return this.withProfessional(actorId, async (client) => {
      const analysis = await client.query(`
        SELECT version FROM medv2_analysis
        WHERE "userId" = $1 AND id = $2 AND status = 'completed'
        ORDER BY version DESC LIMIT 1
      `, [input.patientId, input.analysisId]);
      if (!analysis.rows[0]) return null;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${input.patientId}:${input.analysisId}`]);
      const draft = await client.query(`
        SELECT id FROM medv2_plan_revision
        WHERE "userId" = $1 AND "analysisId" = $2 AND "analysisVersion" = $3 AND status = 'draft'
        ORDER BY version DESC LIMIT 1
      `, [input.patientId, input.analysisId, analysis.rows[0].version]);
      if (!draft.rows[0]) return null;
      await client.query(`
        UPDATE medv2_plan_revision
        SET status = 'archived', "updatedAt" = NOW()
        WHERE "userId" = $1 AND "analysisId" = $2 AND "analysisVersion" = $3 AND status = 'published'
      `, [input.patientId, input.analysisId, analysis.rows[0].version]);
      const result = await client.query(`
        UPDATE medv2_plan_revision
        SET status = 'published', "publishedBy" = $2, "publishedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $1
        RETURNING id, "userId" AS "patientId", "analysisId", "analysisVersion", version, status, source,
                  payload, "createdBy", "publishedBy", "createdAt", "updatedAt", "publishedAt"
      `, [draft.rows[0].id, actorId]);
      const revision = this.revision(result.rows[0]);
      await this.audit(client, actorId, input.patientId, "plan.published", revision);
      return revision;
    });
  }

  private async audit(client: pg.PoolClient, actorId: string, patientId: string, action: string, revision: PlanRevision): Promise<void> {
    await client.query(`
      INSERT INTO medv2_audit_event("userId", "actorUserId", action, resource_type, resource_id, outcome, metadata)
      VALUES ($1, $2, $3, 'plan_revision', $4, 'success', $5::jsonb)
    `, [patientId, actorId, action, revision.id, JSON.stringify({ analysisId: revision.analysisId, version: revision.version })]);
  }
}
