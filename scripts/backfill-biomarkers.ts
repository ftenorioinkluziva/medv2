import process from "node:process";
import { AnalysisSchema } from "../backend/src/core/schemas/analysis.js";
import { persistStructuredBiomarkers } from "../backend/src/adapters/database/BiomarkerPersistence.js";
import { closePool, getPool } from "../backend/src/adapters/database/PostgresPool.js";

async function main(): Promise<void> {
  const pool = getPool();
  const users = await pool.query<{ id: string }>(`SELECT id FROM "user" ORDER BY id`);
  let analysesCount = 0;
  let biomarkerCount = 0;
  for (const user of users.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.user_id', $1, true)", [user.id]);
      const result = await client.query<{ payload: unknown }>(`
        SELECT payload FROM medv2_analysis
        WHERE "userId" = $1
        ORDER BY "createdAt" ASC
      `, [user.id]);
      for (const row of result.rows) {
        const analysis = AnalysisSchema.parse(row.payload);
        await persistStructuredBiomarkers(client, user.id, analysis);
        analysesCount += 1;
        biomarkerCount += analysis.biomarkers.length;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  console.log(JSON.stringify({ success: true, users: users.rowCount, analyses: analysesCount, biomarkers: biomarkerCount }));
}

main()
  .catch((error) => {
    console.error("[db:backfill-biomarkers] failed", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => closePool());
