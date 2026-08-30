import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { getPool } from "../backend/src/adapters/database/PostgresPool.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = path.join(root, "db", "migrations");

async function main(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('medv2-schema-migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS medv2_schema_migration (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const files = (await fs.readdir(migrationDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const exists = await client.query("SELECT 1 FROM medv2_schema_migration WHERE version = $1", [version]);
      if (exists.rowCount) continue;
      const sql = await fs.readFile(path.join(migrationDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO medv2_schema_migration(version) VALUES ($1)", [version]);
        await client.query("COMMIT");
        console.log(`[db:migrate] applied ${version}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('medv2-schema-migrations'))").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[db:migrate] failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
