import { BackofficePlanPort } from "../ports/BackofficePlanPort";
import {
  BackofficePlanInputSchema,
  SavePlanDraftInput,
  SavePlanDraftInputSchema,
  ensureStructuredPlanContent
} from "../schemas/backoffice";
import { Result } from "../types/Result";
import { OperationError } from "../types/errors";

function failure(code: string, message: string): Result<never> {
  return { ok: false, error: { code, category: "validation", message, retryable: false } satisfies OperationError };
}

export class ListBackofficePatientsUseCase {
  constructor(private readonly plans: BackofficePlanPort) {}
  async execute(actorId: string) { return this.plans.listPatients(actorId); }
}

export class GetBackofficePlanEditorUseCase {
  constructor(private readonly plans: BackofficePlanPort) {}
  async execute(actorId: string, input: unknown) {
    const parsed = BackofficePlanInputSchema.parse(input);
    return this.plans.getEditor(actorId, parsed);
  }
}

export class SaveBackofficePlanDraftUseCase {
  constructor(private readonly plans: BackofficePlanPort) {}
  async execute(actorId: string, input: unknown): Promise<Result<Awaited<ReturnType<BackofficePlanPort["saveDraft"]>>>> {
    const parsed = SavePlanDraftInputSchema.safeParse(input);
    if (!parsed.success) return failure("INVALID_PLAN", "O plano enviado não possui um formato válido.");
    return { ok: true, value: await this.plans.saveDraft(actorId, {
      ...parsed.data,
      content: ensureStructuredPlanContent(parsed.data.content)
    }) };
  }
}

export class PublishBackofficePlanUseCase {
  constructor(private readonly plans: BackofficePlanPort) {}
  async execute(actorId: string, input: unknown): Promise<Result<Awaited<ReturnType<BackofficePlanPort["publishDraft"]>>>> {
    const parsed = BackofficePlanInputSchema.parse(input);
    const published = await this.plans.publishDraft(actorId, parsed);
    if (!published) return failure("PLAN_DRAFT_NOT_FOUND", "Salve um rascunho antes de publicar o plano.");
    return { ok: true, value: published };
  }
}
