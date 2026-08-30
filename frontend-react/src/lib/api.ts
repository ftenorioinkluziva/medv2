import type { Analysis, ClinicalDocument, Profile, Session, Settings, StructuredBiomarker, Weekday, WorkoutChecklist, WorkoutTaskCompletion } from "../types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryable?: boolean
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.success === false) {
    const operationError = (payload.error ?? {}) as { message?: string; code?: string; retryable?: boolean };
    throw new ApiError(operationError.message ?? "Não foi possível concluir a operação.", response.status, operationError.code, operationError.retryable);
  }
  return payload as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const api = {
  session: () => request<Session | null>("/api/auth/get-session"),
  signIn: (email: string, password: string) => request("/api/auth/sign-in/email", json({ email, password })),
  signUp: (name: string, email: string, password: string) => request("/api/auth/sign-up/email", json({ name, email, password })),
  signOut: () => request("/api/auth/sign-out", { method: "POST" }),
  settings: () => request<{ success: true; settings: Settings }>("/api/settings"),
  saveSettings: (settings: Partial<Settings>) => request<{ success: true; message: string }>("/api/settings", json(settings)),
  profile: () => request<{ success: true; profile: Profile }>("/api/profile"),
  saveProfile: (profile: Profile) => request<{ success: true; profile: Profile; message: string }>("/api/profile", json(profile)),
  documents: () => request<{ success: true; documents: ClinicalDocument[] }>("/api/documents"),
  analyses: () => request<{ success: true; analyses: Analysis[] }>("/api/analyses"),
  biomarkers: () => request<{ success: true; biomarkers: StructuredBiomarker[] }>("/api/biomarkers/history"),
  workoutChecklist: (analysisId: string, weekday: Weekday) => request<{ success: true; checklist: WorkoutChecklist }>(`/api/workout/checklist?analysisId=${encodeURIComponent(analysisId)}&weekday=${encodeURIComponent(weekday)}`),
  updateWorkoutTaskCompletion: (input: { analysisId: string; weekday: Weekday; taskKey: string; completed: boolean }) => request<{ success: true; completion: WorkoutTaskCompletion }>("/api/workout/checklist/completion", json(input)),
  saveAnnotations: (analysisId: string, annotations: string) => request<{ success: true; analysis: Analysis; message: string }>(`/api/analyses/${encodeURIComponent(analysisId)}/annotations`, json({ annotations })),
  upload: async (file: File, docType: ClinicalDocument["type"]) => {
    const form = new FormData();
    form.append("pdf", file);
    form.append("docType", docType);
    return request<{ success: true; message: string; analysis?: Analysis }>("/api/upload-document", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: form
    });
  }
};
