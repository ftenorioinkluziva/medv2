export type ViewId = "dashboard" | "labs" | "scores" | "profile" | "history";
export type DetailTab = "status" | "insights" | "supplements" | "nutrition" | "training";
export type BiomarkerStatus = "normal" | "alto" | "baixo" | "alterado";
export type Weekday = "Segunda-feira" | "Terça-feira" | "Quarta-feira" | "Quinta-feira" | "Sexta-feira" | "Sábado" | "Domingo";

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  retryable?: boolean;
}

export interface Biomarker {
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: BiomarkerStatus;
}

export interface Meal {
  name: string;
  time: string;
  description: string;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
}

export interface Supplement {
  name: string;
  purpose: string;
  dose: string;
  frequency: string;
}

export interface DeterministicAlert {
  biomarker: string;
  value: unknown;
  unit: string;
  optimalRange: string;
  severity: "info" | "warning" | "danger";
  insight: string;
  protocol: string;
  source: string;
}

export interface Analysis {
  id: string;
  date: string;
  bloodTestFilename: string;
  biomarkers: Biomarker[];
  healthStatus: string;
  supplementation: Supplement[];
  nutritionPlan: Record<Weekday, string | Meal[]>;
  trainingPlan: Record<Weekday, string>;
  deterministicAlerts: DeterministicAlert[];
  nutritionOrientation: string;
  trainingOrientation: string;
  createdAt: string;
  annotations?: string;
}

export type WorkoutTaskStatus = "pending" | "completed" | "review";

export interface WorkoutChecklistTask {
  taskKey: string;
  weekday: Weekday;
  order: number;
  sourceExerciseName: string;
  exerciseId: string | null;
  exerciseName: string | null;
  bodyPart: string | null;
  target: string | null;
  imageUrl: string | null;
  animationUrl: string | null;
  steps: string[];
  prescription: string;
  status: WorkoutTaskStatus;
  reviewReason: string | null;
}

export interface WorkoutChecklistDay {
  weekday: Weekday;
  title: string;
  message: string;
  isRestDay: boolean;
  tasks: WorkoutChecklistTask[];
}

export interface WorkoutChecklist {
  analysisId: string;
  analysisDate: string;
  weekday: Weekday;
  day: WorkoutChecklistDay;
}

export interface WorkoutTaskCompletion {
  analysisId: string;
  weekday: Weekday;
  taskKey: string;
  completed: boolean;
  completedAt: string | null;
}

export interface ClinicalDocument {
  id: string;
  name: string;
  type: "blood-test" | "bioimpedance";
  date: string;
  status: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
}

export interface StructuredBiomarker {
  analysisId: string;
  analysisVersion: number;
  date: string;
  biomarkerCode: string;
  biomarkerName: string;
  valueNumeric: number | null;
  valueText: string;
  unit: string;
  status: BiomarkerStatus;
  referenceRange: string;
  annotations: string;
}

export interface Settings {
  hasKey: boolean;
  openrouterApiKey?: string;
  modelExtraction: string;
  modelAnalysis: string;
  lens: "longevidade" | "convencional" | "performance";
  lensLongevidade?: string;
  lensConvencional?: string;
  lensPerformance?: string;
}

export interface Profile {
  nome: string;
  idade: number;
  sexo: string;
  altura: number;
  peso: number;
  imc: number;
  massaMagra: number;
  inbodyScore: number | null;
  cardioSistolica: number;
  cardioDiastolica: number;
  cardioFcRepouso: number;
  objetivos: string;
  historicoFamiliar: string;
  observacoes: string;
  condicoesMedicas: string;
  medicamentos: string;
  alergias: string;
  cirurgias: string;
  sonoHoras: number;
  sonoQualidade: number;
  sonoTempoCama: number;
  sonoRegularidade: string;
  sonoProblemas: string;
  aguaDia: number;
  nivelEstresse: number;
  tabagismo: string;
  dietaAtual: string;
  gestaoEstresse: string;
  suplementacaoAtual: string;
  cronoExposicaoSolar: string;
  cronoUltimaRefeicao: string;
  cronoLuzArtInicio: string;
  cronoLuzArtFim: string;
  cronoObsLuz: string;
  perfForcaPreensao: number;
  perfSentarLevantar: number;
  perfVo2Max: number;
  perfToleranciaCo2: number;
  perfAtividadeFisica: string;
  limitacoesFisicas: string;
  dietType: string;
  eatingPattern: string;
  proteinIntake: string;
  fluidIntake: string;
  dietaryRestrictions: string;
  alcoholConsumption: string;
  caffeineIntake: string;
  latestCaffeineTime: string;
  recentDietChanges: string;
  typicalMeals: string;
  bowelFrequency: string;
  stoolConsistency: string;
  bloating: string;
  gas: string;
  acidReflux: string;
  burping: string;
  nausea: string;
  appetite: string;
  abdominalPain: string;
  foodSensitivities: string;
  dietaryNotes: string;
  exerciseFrequency: string;
  exerciseTypes: string;
  exerciseIntensity: string;
  typicalSessionDuration: string;
  dailyMovement: string;
  muscleContext: string;
  limitationsAndRecovery: string;
  exerciseNotes: string;
}

export interface Session {
  user?: { id?: string; name?: string; email?: string };
  session?: { id?: string; expiresAt?: string };
}
