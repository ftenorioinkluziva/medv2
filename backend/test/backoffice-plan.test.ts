import assert from "node:assert/strict";
import test from "node:test";
import { BackofficePlanPort } from "../src/core/ports/BackofficePlanPort";
import { BackofficePlanEditor, BackofficePatient, PlanRevision, SavePlanDraftInput } from "../src/core/schemas/backoffice";
import { PlanContent } from "../src/core/schemas/analysis";
import { GetBackofficePlanEditorUseCase, PublishBackofficePlanUseCase, SaveBackofficePlanDraftUseCase } from "../src/core/use-cases/BackofficePlanUseCases";

const content: PlanContent = {
  supplementation: [{ name: "Vitamina D", purpose: "Suporte", dose: "2000 UI", frequency: "diária" }],
  nutritionPlan: {
    "Segunda-feira": "Plano A", "Terça-feira": "", "Quarta-feira": "", "Quinta-feira": "",
    "Sexta-feira": "", "Sábado": "", "Domingo": ""
  },
  trainingPlan: {
    "Segunda-feira": "### Treino A", "Terça-feira": "", "Quarta-feira": "", "Quinta-feira": "",
    "Sexta-feira": "", "Sábado": "", "Domingo": ""
  },
  nutritionOrientation: "Orientação nutricional",
  trainingOrientation: "Orientação de treino"
};

const patient: BackofficePatient = {
  id: "patient-1", name: "Paciente", email: "patient@example.com", analyses: [{
    id: "analysis-1", date: "2026-08-30", bloodTestFilename: "exam.pdf", createdAt: "2026-08-30T12:00:00.000Z"
  }]
};

function revision(status: PlanRevision["status"] = "draft"): PlanRevision {
  return {
    id: "plan-1", patientId: "patient-1", analysisId: "analysis-1", analysisVersion: 1, version: 1,
    status, source: "manual", content, createdBy: "professional-1", publishedBy: status === "published" ? "professional-1" : null,
    createdAt: "2026-08-30T12:00:00.000Z", updatedAt: "2026-08-30T12:00:00.000Z",
    publishedAt: status === "published" ? "2026-08-30T12:00:00.000Z" : null
  };
}

class FakeBackofficePlan implements BackofficePlanPort {
  draft: PlanRevision | null = null;
  published: PlanRevision | null = null;
  async listPatients(): Promise<BackofficePatient[]> { return [patient]; }
  async getEditor(): Promise<BackofficePlanEditor> {
    return { patient: { id: patient.id, name: patient.name, email: patient.email }, analysis: patient.analyses[0], generated: content, published: this.published, draft: this.draft, history: [this.draft, this.published].filter(Boolean) as PlanRevision[] };
  }
  async saveDraft(_actorId: string, input: SavePlanDraftInput): Promise<PlanRevision> {
    this.draft = { ...revision(), content: input.content };
    return this.draft;
  }
  async publishDraft(): Promise<PlanRevision | null> {
    if (!this.draft) return null;
    this.published = { ...this.draft, status: "published", publishedBy: "professional-1", publishedAt: "2026-08-30T13:00:00.000Z" };
    this.draft = null;
    return this.published;
  }
}

test("backoffice saves a validated plan draft", async () => {
  const port = new FakeBackofficePlan();
  const useCase = new SaveBackofficePlanDraftUseCase(port);
  const result = await useCase.execute("professional-1", { patientId: "patient-1", analysisId: "analysis-1", content });
  assert.equal(result.ok, true);
  assert.equal(port.draft?.content.trainingPlan["Segunda-feira"], "### Treino A");
});

test("backoffice rejects invalid plan content before persistence", async () => {
  let called = false;
  const port = new FakeBackofficePlan();
  port.saveDraft = async () => { called = true; return revision(); };
  const result = await new SaveBackofficePlanDraftUseCase(port).execute("professional-1", { patientId: "patient-1", analysisId: "analysis-1", content: { ...content, supplementation: [{ name: "invalid" }] } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "INVALID_PLAN");
  assert.equal(called, false);
});

test("backoffice requires a draft before publishing", async () => {
  const port = new FakeBackofficePlan();
  const result = await new PublishBackofficePlanUseCase(port).execute("professional-1", { patientId: "patient-1", analysisId: "analysis-1" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "PLAN_DRAFT_NOT_FOUND");
});

test("backoffice editor exposes generated and revision content", async () => {
  const port = new FakeBackofficePlan();
  const editor = await new GetBackofficePlanEditorUseCase(port).execute("professional-1", { patientId: "patient-1", analysisId: "analysis-1" });
  assert.equal(editor.generated.nutritionOrientation, "Orientação nutricional");
  assert.equal(editor.draft, null);
});
