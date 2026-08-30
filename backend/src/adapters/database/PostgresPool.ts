import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL é obrigatório para o runtime PostgreSQL.");
    pool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX || 10) });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = undefined;
}
