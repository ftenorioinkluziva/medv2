import process from "node:process";
import { auth } from "../backend/src/auth.js";
import { closePool, getPool } from "../backend/src/adapters/database/PostgresPool.js";

async function main(): Promise<void> {
  const email = process.env.MEDV2_BOOTSTRAP_EMAIL;
  const password = process.env.MEDV2_BOOTSTRAP_PASSWORD;
  const name = process.env.MEDV2_BOOTSTRAP_NAME || "Usuário MedV2";
  if (!email || !password) throw new Error("Defina MEDV2_BOOTSTRAP_EMAIL e MEDV2_BOOTSTRAP_PASSWORD.");
  if (password.length < 8) throw new Error("MEDV2_BOOTSTRAP_PASSWORD deve ter pelo menos 8 caracteres.");

  const result = await auth.api.signUpEmail({ body: { name, email, password } });
  console.log(JSON.stringify({ success: true, userId: result.user.id, email: result.user.email }));
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [result.user.id]);
    await client.query(`
      INSERT INTO medv2_profile("userId", payload) VALUES ($1, '{}'::jsonb)
      ON CONFLICT ("userId") DO NOTHING
    `, [result.user.id]);
    await client.query(`
      INSERT INTO medv2_settings("userId", payload) VALUES ($1, '{}'::jsonb)
      ON CONFLICT ("userId") DO NOTHING
    `, [result.user.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

main().catch((error) => {
  console.error("[db:bootstrap] failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}).finally(() => closePool());
