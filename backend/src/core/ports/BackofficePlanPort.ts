import {
  BackofficePatient,
  BackofficePlanEditor,
  BackofficePlanInput,
  PlanRevision,
  SavePlanDraftInput
} from "../schemas/backoffice";

export interface BackofficePlanPort {
  listPatients(actorId: string): Promise<BackofficePatient[]>;
  getEditor(actorId: string, input: BackofficePlanInput): Promise<BackofficePlanEditor | null>;
  saveDraft(actorId: string, input: SavePlanDraftInput): Promise<PlanRevision>;
  publishDraft(actorId: string, input: BackofficePlanInput): Promise<PlanRevision | null>;
}
