import fs from "fs";
import path from "path";
import { HandoffGrantPort } from "../../core/ports/HandoffPort";
import { HandoffGrant, HandoffGrantSchema } from "../../core/schemas/handoff";
import { OperationFailure } from "../../core/types/errors";

export class JsonHandoffGrantAdapter implements HandoffGrantPort {
  constructor(private readonly filePath: string) {}

  async save(_userId: string, grant: HandoffGrant): Promise<void> {
    const grants = this.read().filter((item) => item.contractId !== grant.contractId);
    grants.push(HandoffGrantSchema.parse(grant));
    this.write(grants);
  }

  async authorize(contractId: string, subject: string, now: Date): Promise<{ userId: string } | null> {
    const grants = this.read();
    const grant = grants.find((item) => item.contractId === contractId && item.subject === subject);
    if (!grant || new Date(grant.expiresAt) <= now) return null;
    grant.lastAccessedAt = now.toISOString();
    this.write(grants.filter((item) => new Date(item.expiresAt) > now));
    return { userId: grant.subject.split(":", 1)[0] || "legacy" };
  }

  private read(): HandoffGrant[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      return HandoffGrantSchema.array().parse(JSON.parse(fs.readFileSync(this.filePath, "utf8")));
    } catch (error) {
      throw new OperationFailure({
        code: "HANDOFF_GRANTS_INVALID",
        category: "internal",
        message: "Os grants da integração OpenGym são inválidos.",
        retryable: false
      }, { cause: error });
    }
  }

  private write(grants: HandoffGrant[]): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(grants, null, 2), "utf8");
      fs.renameSync(temporary, this.filePath);
    } catch (error) {
      throw new OperationFailure({
        code: "HANDOFF_GRANT_WRITE_FAILED",
        category: "internal",
        message: "Não foi possível registrar a autorização do handoff.",
        retryable: false
      }, { cause: error });
    }
  }
}
