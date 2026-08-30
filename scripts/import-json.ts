import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "../backend/src/adapters/database/PostgresPool.js";
import { AnalysisSchema } from "../backend/src/core/schemas/analysis.js";
import { DocumentSchema } from "../backend/src/core/schemas/document.js";
import { HandoffGrantSchema } from "../backend/src/core/schemas/handoff.js";
import { ProfileSchema } from "../backend/src/core/schemas/profile.js";
import { SettingsSchema } from "../backend/src/core/schemas/settings.js";
import { persistStructuredBiomarkers } from "../backend/src/adapters/database/BiomarkerPersistence.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8")) as T; }
  catch { return fallback; }
}

async function main(): Promise<void> {
  const userId = process.env.MEDV2_IMPORT_USER_ID;
  if (!userId) throw new Error("Defina MEDV2_IMPORT_USER_ID com o usuário de destino.");
  const pool = getPool();
  const profile = ProfileSchema.parse(await readJson("profile.json", {}));
  const settings = SettingsSchema.parse(await readJson("settings.json", {}));
  const documents = DocumentSchema.array().parse(await readJson("documents.json", []));
  const analyses = AnalysisSchema.array().parse(await readJson("analyses.json", []));
  const grantsRaw = await readJson<unknown>("handoff-grants.json", []);
  const grants = HandoffGrantSchema.array().safeParse(Array.isArray(grantsRaw) ? grantsRaw : grantsRaw && typeof grantsRaw === "object" && "contractId" in grantsRaw ? [grantsRaw] : []);
  const client = await pool.connect();
  const issues: Array<{ source: string; sourceId?: string; reason: string; details?: unknown }> = [];
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    await client.query(`INSERT INTO medv2_profile("userId", payload) VALUES ($1, $2::jsonb) ON CONFLICT ("userId") DO NOTHING`, [userId, JSON.stringify(profile)]);
    const { openrouterApiKey: _secret, ...safeSettings } = settings;
    await client.query(`INSERT INTO medv2_settings("userId", payload) VALUES ($1, $2::jsonb) ON CONFLICT ("userId") DO NOTHING`, [userId, JSON.stringify(safeSettings)]);
    for (const document of documents) {
      await client.query(`
        INSERT INTO medv2_document(id, "userId", name, type, exam_date, status, "originalName", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING
      `, [document.id, userId, document.name, document.type, document.date, document.status, document.originalName, document.uploadedAt]);
      const fileExists = await fs.stat(path.join(root, "uploads", document.filename)).then(() => true).catch(() => false);
      await client.query(`
        INSERT INTO medv2_document_blob("documentId", "storageKey", sha256, size_bytes, mime_type, status)
        VALUES ($1, $2, encode(digest($2, 'sha256'), 'hex'), 0, 'application/pdf', $3)
        ON CONFLICT ("documentId") DO NOTHING
      `, [document.id, document.filename, fileExists ? "available" : "missing"]);
    }
    for (const analysis of analyses) {
      const matches = documents.filter((document) => document.originalName === analysis.bloodTestFilename && document.date === analysis.date);
      const documentId = matches.length === 1 ? matches[0].id : null;
      if (matches.length !== 1) issues.push({ source: "analysis", sourceId: analysis.id, reason: matches.length ? "ambiguous_document_match" : "document_not_found", details: { bloodTestFilename: analysis.bloodTestFilename, date: analysis.date, matches: matches.map((item) => item.id) } });
      await client.query(`
        INSERT INTO medv2_analysis(id, "userId", "documentId", version, input_fingerprint, payload, "createdAt")
        VALUES ($1, $2, $3, 1, encode(digest($4, 'sha256'), 'hex'), $4::jsonb, $5) ON CONFLICT (id, version) DO NOTHING
      `, [analysis.id, userId, documentId, JSON.stringify(analysis), analysis.createdAt]);
      await persistStructuredBiomarkers(client, userId, analysis);
    }
    if (grants.success) {
      for (const grant of grants.data) {
        const subject = grant.subject.includes(":") ? grant.subject : `${userId}:${grant.subject}`;
        await client.query(`
          INSERT INTO medv2_handoff_grant("contractId", "userId", subject, status, "createdAt", "expiresAt", "lastAccessedAt")
          VALUES ($1, $2, $3, CASE WHEN $5 <= NOW() THEN 'expired' ELSE 'active' END, $4, $5, $6) ON CONFLICT DO NOTHING
        `, [grant.contractId, userId, subject, grant.createdAt, grant.expiresAt, grant.lastAccessedAt || null]);
      }
    }
    for (const issue of issues) await client.query(`INSERT INTO medv2_migration_issue(source, source_id, reason, details) VALUES ($1, $2, $3, $4::jsonb)`, [issue.source, issue.sourceId || null, issue.reason, JSON.stringify(issue.details || {})]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ success: true, profile: 1, settings: 1, documents: documents.length, analyses: analyses.length, issues: issues.length }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); await closePool(); }
}

main().catch((error) => { console.error("[db:import-json] failed", error instanceof Error ? error.message : "unknown error"); process.exitCode = 1; });
