import { DatabasePort } from "../ports/DatabasePort";
import { HandoffGrantPort, HandoffTokenPort } from "../ports/HandoffPort";
import { RuntimePort } from "../ports/RuntimePort";
import { HandoffGrantSchema, WorkoutContract } from "../schemas/handoff";
import { Result } from "../types/Result";
import { toOperationError } from "../types/errors";
import { MapWorkoutContractUseCase } from "./MapWorkoutContractUseCase";

export class CreateHandoffUseCase {
  constructor(
    private readonly db: DatabasePort,
    private readonly grants: HandoffGrantPort,
    private readonly signer: HandoffTokenPort,
    private readonly runtime: RuntimePort
  ) {}

  async execute(userId: string): Promise<Result<{ handoffToken: string; contractId: string }>> {
    try {
      const profile = await this.db.getProfile(userId);
      const now = this.runtime.now();
      const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
      const contractId = this.runtime.createId("").replace(/^_/, "");
      const subject = "medv2-patient";
      const grant = HandoffGrantSchema.parse({
        contractId,
        subject: `${userId}:${subject}`,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });
      const handoffToken = this.signer.issue({
        iss: "medv0",
        aud: "opengym",
        sub: subject,
        name: profile.nome || "Paciente MedV2",
        contractId,
        nonce: this.runtime.createId("nonce"),
        scopes: ["workout:import"],
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000)
      });
      await this.grants.save(userId, grant);
      return { ok: true, value: {
        contractId,
        handoffToken
      } };
    } catch (error) {
      return { ok: false, error: toOperationError(error, {
        code: "HANDOFF_CREATION_FAILED",
        category: "internal",
        message: "Não foi possível iniciar o handoff para o OpenGym.",
        retryable: false
      }) };
    }
  }
}

export class GetWorkoutContractUseCase {
  constructor(
    private readonly grants: HandoffGrantPort,
    private readonly mapper: MapWorkoutContractUseCase,
    private readonly runtime: RuntimePort
  ) {}

  async execute(contractId: string, subject: string): Promise<Result<WorkoutContract>> {
    try {
      const grant = await this.grants.authorize(contractId, subject, this.runtime.now());
      if (!grant) {
        return { ok: false, error: {
          code: "HANDOFF_GRANT_INVALID",
          category: "authorization",
          message: "O contrato não está autorizado ou expirou.",
          retryable: false
        } };
      }
      return this.mapper.execute(contractId, subject, grant.userId);
    } catch (error) {
      return { ok: false, error: toOperationError(error, {
        code: "WORKOUT_CONTRACT_FAILED",
        category: "internal",
        message: "Não foi possível obter o contrato de treino.",
        retryable: false
      }) };
    }
  }
}
