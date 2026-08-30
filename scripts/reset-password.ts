import process from "node:process";
import { auth } from "../backend/src/auth.js";
import { closePool, getPool } from "../backend/src/adapters/database/PostgresPool.js";

async function main(): Promise<void> {
  const email = process.env.MEDV2_RESET_EMAIL?.trim().toLowerCase();
  const password = process.env.MEDV2_RESET_PASSWORD;
  if (!email || !password) {
    throw new Error("Defina MEDV2_RESET_EMAIL e MEDV2_RESET_PASSWORD.");
  }
  if (password.length < 8) {
    throw new Error("MEDV2_RESET_PASSWORD deve ter pelo menos 8 caracteres.");
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query<{ id: string }>(
      `SELECT id FROM "user" WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    if (userResult.rowCount !== 1) throw new Error("Usuário não encontrado.");

    const userId = userResult.rows[0].id;
    const accountResult = await client.query<{ id: string }>(
      `SELECT id FROM account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
      [userId],
    );
    if (accountResult.rowCount !== 1) throw new Error("Usuário não possui conta por senha.");

    const context = await auth.$context;
    const passwordHash = await context.password.hash(password);
    await client.query(
      `UPDATE account SET password = $1, "updatedAt" = now() WHERE id = $2`,
      [passwordHash, accountResult.rows[0].id],
    );
    await client.query(`DELETE FROM session WHERE "userId" = $1`, [userId]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ success: true, email }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("[db:reset-password] failed", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(() => closePool());
