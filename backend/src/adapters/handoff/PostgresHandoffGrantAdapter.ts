import { HandoffGrantPort } from "../../core/ports/HandoffPort";
import { HandoffGrant, HandoffGrantSchema } from "../../core/schemas/handoff";
import { OperationFailure } from "../../core/types/errors";
import { getPool } from "../database/PostgresPool";

export class PostgresHandoffGrantAdapter implements HandoffGrantPort {
  private readonly pool = getPool();

  async save(userId: string, grant: HandoffGrant): Promise<void> {
    try {
      const parsed = HandoffGrantSchema.parse(grant);
      const client = await this.pool.connect();
      try {
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
        await client.query(`
          INSERT INTO medv2_handoff_grant("contractId", "userId", subject, status, "createdAt", "expiresAt")
          VALUES ($1, $2, $3, 'active', $4, $5)
          ON CONFLICT ("contractId") DO UPDATE SET subject = EXCLUDED.subject, "expiresAt" = EXCLUDED."expiresAt", status = 'active'
        `, [parsed.contractId, userId, parsed.subject, parsed.createdAt, parsed.expiresAt]);
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
      finally { client.release(); }
    } catch (error) {
      if (error instanceof OperationFailure) throw error;
      throw new OperationFailure({ code: "HANDOFF_GRANT_WRITE_FAILED", category: "internal", message: "Não foi possível registrar a autorização do handoff.", retryable: false }, { cause: error });
    }
  }

  async authorize(contractId: string, subject: string, now: Date): Promise<{ userId: string } | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.service_access', 'true', true)");
      const result = await client.query(`
        UPDATE medv2_handoff_grant
        SET "lastAccessedAt" = $3, status = CASE WHEN "expiresAt" <= $3 THEN 'expired' ELSE status END
        WHERE "contractId" = $1 AND subject = $2 AND status = 'active' AND "expiresAt" > $3
        RETURNING "userId"
      `, [contractId, subject, now]);
      await client.query("COMMIT");
      return result.rows[0] ? { userId: result.rows[0].userId } : null;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw new OperationFailure({ code: "HANDOFF_GRANT_READ_FAILED", category: "internal", message: "Não foi possível validar a autorização do handoff.", retryable: false }, { cause: error });
    } finally { client.release(); }
  }
}
