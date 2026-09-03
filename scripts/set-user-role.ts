import process from "node:process";
import { UserRoleSchema } from "../backend/src/core/schemas/backoffice.js";
import { closePool, getPool } from "../backend/src/adapters/database/PostgresPool.js";

async function main(): Promise<void> {
  const email = process.env.MEDV2_ROLE_EMAIL;
  const role = UserRoleSchema.parse(process.env.MEDV2_ROLE || "professional");
  if (!email) throw new Error("Defina MEDV2_ROLE_EMAIL.");
  const result = await getPool().query(`UPDATE "user" SET role = $1, "updatedAt" = NOW() WHERE email = $2 RETURNING id`, [role, email]);
  if (!result.rowCount) throw new Error("Usuário não encontrado.");
  console.log(JSON.stringify({ success: true, role }));
}

main().catch((error) => {
  console.error("[db:set-role] failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}).finally(() => closePool());
