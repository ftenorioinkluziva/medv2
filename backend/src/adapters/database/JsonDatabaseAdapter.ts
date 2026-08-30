import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DatabasePort } from "../../core/ports/DatabasePort";
import { Profile, ProfileSchema } from "../../core/schemas/profile";
import { Settings, SettingsSchema } from "../../core/schemas/settings";
import { Analysis } from "../../core/schemas/analysis";
import { AnalysisSchema } from "../../core/schemas/analysis";
import { Document, DocumentSchema } from "../../core/schemas/document";
import { Weekday, WorkoutTaskCompletion, WorkoutTaskCompletionSchema } from "../../core/schemas/workout-checklist";
import { OperationFailure } from "../../core/types/errors";
import { AnalysisConfiguration, AnalysisConfigurationPort, OpenRouterCredentialPort } from "../../core/ports/ConfigurationPort";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "data");

const DEFAULT_PROFILE: Profile = {
  nome: "Paciente MedV2",
  idade: 45,
  sexo: "masculino",
  altura: 170,
  peso: 90.9,
  imc: 31.5,
  massaMagra: 36.7,
  inbodyScore: 74,
  cardioSistolica: 120,
  cardioDiastolica: 80,
  cardioFcRepouso: 65,
  objetivos: "Perda de peso, melhora do condicionamento físico, controle da glicemia.",
  historicoFamiliar: "Diabetes no pai, hipertensão na mãe...",
  observacoes: "Sedentário nos últimos 2 anos. Sente-se cansado ao final do dia.",
  condicoesMedicas: "Hipertensão, pré-diabetes...",
  medicamentos: "Metformina 500mg...",
  alergias: "Penicilina, látex...",
  cirurgias: "Apendicectomia 2015...",
  
  sonoHoras: 7.5,
  sonoQualidade: 8,
  sonoTempoCama: 8.0,
  sonoRegularidade: "regular",
  sonoProblemas: "insônia, roncos",
  aguaDia: 2.0,
  nivelEstresse: 5,
  tabagismo: "Parou em 2020, fumava 5 cigarros/dia...",
  dietaAtual: "low carb, mediterrânea",
  gestaoEstresse: "meditação, exercício",
  suplementacaoAtual: "Nenhuma ativa.",
  cronoExposicaoSolar: "07:30",
  cronoUltimaRefeicao: "20:30",
  cronoLuzArtInicio: "06:00",
  cronoLuzArtFim: "23:00",
  cronoObsLuz: "tela de celular até 23h",

  perfForcaPreensao: 42.5,
  perfSentarLevantar: 12.3,
  perfVo2Max: 45.0,
  perfToleranciaCo2: 40,
  perfAtividadeFisica: "Nenhuma atividade adicionada.",
  limitacoesFisicas: "dor no joelho direito",

  // Diet & Digestion Anamnesis
  dietType: "",
  eatingPattern: "",
  proteinIntake: "",
  fluidIntake: "",
  dietaryRestrictions: "",
  alcoholConsumption: "",
  caffeineIntake: "",
  latestCaffeineTime: "",
  recentDietChanges: "",
  typicalMeals: "",
  bowelFrequency: "",
  stoolConsistency: "",
  bloating: "",
  gas: "",
  acidReflux: "",
  burping: "",
  nausea: "",
  appetite: "",
  abdominalPain: "",
  foodSensitivities: "",
  dietaryNotes: "",

  // Exercise Anamnesis
  exerciseFrequency: "",
  exerciseTypes: "",
  exerciseIntensity: "",
  typicalSessionDuration: "",
  dailyMovement: "",
  muscleContext: "",
  limitationsAndRecovery: "",
  exerciseNotes: ""
};

const DEFAULT_SETTINGS: Settings = {
  openrouterApiKey: "",
  modelExtraction: "google/gemini-2.5-flash",
  modelAnalysis: "google/gemini-2.5-pro",
  lens: "longevidade",
  lensLongevidade: `Você deve adotar a Lente de Otimização e Longevidade (Biohacking).
Não se limite a analisar as faixas de referência padrão dos laboratórios clínicos. Compare os resultados com as faixas ideais/ótimas voltadas para longevidade e alto rendimento biológico.
Por exemplo: HOMA-IR ideal < 1.5, Ferritina ótima ~100 ng/mL, HDL ideal > 50 mg/dL, Triglicerídeos/HDL ideal < 2.0.
Destaque no diagnóstico se o paciente está fora dessas faixas otimizadas e prescreva suplementações e treinos voltados para otimização metabólica fina e envelhecimento saudável.`,
  lensConvencional: `Você deve adotar a Lente da Medicina Convencional.
Analise os resultados do exame e bioimpedância estritamente sob os limites de referência habituais dos laboratórios clínicos.
Foque na identificação de patologias clássicas instaladas, carências nutricionais clínicas graves e disfunções orgânicas óbvias, recomendando ações preventivas tradicionais baseadas em consensos médicos.`,
  lensPerformance: `Você deve adotar a Lente de Performance Esportiva.
Foque as recomendações de nutrição, treino e suplementação para maximizar o ganho de massa muscular magra, aumento de força física, melhora do VO2 máx e aceleração da recuperação muscular pós-treino.
Interprete os biomarcadores sob a ótica de otimização de performance física para atletas ou praticantes de atividade física intensa.`
};

export class JsonDatabaseAdapter implements DatabasePort, AnalysisConfigurationPort, OpenRouterCredentialPort {
  constructor(private readonly dataDirectory: string = DATA_DIR) {}

  private ensureDirExists() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private getFilePath(filename: string): string {
    this.ensureDirExists();
    return path.join(this.dataDirectory, filename);
  }

  private readJsonFile<T>(filename: string, defaultValue: T): unknown {
    const filePath = this.getFilePath(filename);
    if (!fs.existsSync(filePath)) {
      this.writeJsonFile(filename, defaultValue);
      return defaultValue;
    }
    try {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (err) {
      throw new OperationFailure({
        code: "PERSISTENCE_READ_FAILED",
        category: "internal",
        message: `Não foi possível ler os dados persistidos em ${filename}.`,
        retryable: false
      }, { cause: err });
    }
  }

  private writeJsonFile(filename: string, data: unknown): void {
    const filePath = this.getFilePath(filename);
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), "utf8");
      fs.renameSync(temporaryPath, filePath);
    } catch (err) {
      if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
      throw new OperationFailure({
        code: "PERSISTENCE_WRITE_FAILED",
        category: "internal",
        message: `Não foi possível persistir os dados em ${filename}.`,
        retryable: false
      }, { cause: err });
    }
  }

  private writeTransaction(entries: Array<{ filename: string; data: unknown }>): void {
    const snapshots = entries.map(({ filename }) => {
      const filePath = this.getFilePath(filename);
      return { filePath, existed: fs.existsSync(filePath), data: fs.existsSync(filePath) ? fs.readFileSync(filePath) : null };
    });

    try {
      for (const entry of entries) this.writeJsonFile(entry.filename, entry.data);
    } catch (error) {
      for (const snapshot of snapshots) {
        try {
          if (snapshot.existed && snapshot.data) fs.writeFileSync(snapshot.filePath, snapshot.data);
          else if (fs.existsSync(snapshot.filePath)) fs.rmSync(snapshot.filePath, { force: true });
        } catch {
          // Best-effort rollback. The original typed persistence error remains canonical.
        }
      }
      throw error;
    }
  }

  async getProfile(_userId = "legacy"): Promise<Profile> {
    const raw = this.readJsonFile("profile.json", DEFAULT_PROFILE);
    return ProfileSchema.parse(raw);
  }

  async saveProfile(_userId: string, profile: Profile): Promise<void> {
    const parsed = ProfileSchema.parse(profile);
    this.writeJsonFile("profile.json", parsed);
  }

  async getSettings(_userId = "legacy"): Promise<Settings> {
    const fileSettings = SettingsSchema.parse(this.readJsonFile<Settings>("settings.json", DEFAULT_SETTINGS));
    // Fallback to process.env if key is empty in file
    if (!fileSettings.openrouterApiKey && process.env.OPENROUTER_API_KEY) {
      fileSettings.openrouterApiKey = process.env.OPENROUTER_API_KEY;
    }
    return SettingsSchema.parse(fileSettings);
  }

  async saveSettings(_userId: string, settings: Settings): Promise<void> {
    const parsed = SettingsSchema.parse(settings);
    this.writeJsonFile("settings.json", parsed);
  }

  async getAnalysisConfiguration(userId = "legacy"): Promise<AnalysisConfiguration> {
    const { openrouterApiKey: _secret, ...configuration } = await this.getSettings(userId);
    return configuration;
  }

  async getOpenRouterApiKey(userId = "legacy"): Promise<string> {
    return (await this.getSettings(userId)).openrouterApiKey;
  }

  async getAnalyses(_userId = "legacy"): Promise<Analysis[]> {
    return AnalysisSchema.array().parse(this.readJsonFile<Analysis[]>("analyses.json", []));
  }

  async getBiomarkerHistory(_userId = "legacy"): Promise<never[]> {
    return [];
  }

  async saveAnalyses(_userId: string, analyses: Analysis[]): Promise<void> {
    this.writeJsonFile("analyses.json", AnalysisSchema.array().parse(analyses));
  }

  async getDocuments(_userId = "legacy"): Promise<Document[]> {
    return DocumentSchema.array().parse(this.readJsonFile<Document[]>("documents.json", []));
  }

  async getWorkoutTaskCompletions(userId: string, analysisId: string, weekday: Weekday): Promise<WorkoutTaskCompletion[]> {
    const records = WorkoutTaskCompletionSchema.extend({ userId: z.string().min(1) }).array().parse(
      this.readJsonFile("workout-completions.json", [])
    );
    return records
      .filter((record) => record.userId === userId && record.analysisId === analysisId && record.weekday === weekday)
      .map(({ userId: _userId, ...completion }) => WorkoutTaskCompletionSchema.parse(completion));
  }

  async saveWorkoutTaskCompletion(userId: string, completion: WorkoutTaskCompletion): Promise<void> {
    const persistedSchema = WorkoutTaskCompletionSchema.extend({ userId: z.string().min(1) });
    const records = persistedSchema.array().parse(this.readJsonFile("workout-completions.json", []));
    const parsed = WorkoutTaskCompletionSchema.parse(completion);
    const index = records.findIndex((record) => record.userId === userId
      && record.analysisId === parsed.analysisId
      && record.weekday === parsed.weekday
      && record.taskKey === parsed.taskKey);
    const record = { userId, ...parsed };
    if (index >= 0) records[index] = persistedSchema.parse(record);
    else records.push(persistedSchema.parse(record));
    this.writeJsonFile("workout-completions.json", records);
  }

  async saveDocuments(_userId: string, documents: Document[]): Promise<void> {
    this.writeJsonFile("documents.json", DocumentSchema.array().parse(documents));
  }

  async updateAnalysisAnnotations(_userId: string, id: string, annotations: string): Promise<Analysis | null> {
    const analyses = await this.getAnalyses();
    const index = analyses.findIndex((analysis) => analysis.id === id);
    if (index === -1) return null;
    analyses[index] = AnalysisSchema.parse({ ...analyses[index], annotations });
    await this.saveAnalyses("legacy", analyses);
    return analyses[index];
  }

  async saveProcessedBloodTest(_userId: string, analysis: Analysis, document: Document): Promise<void> {
    const analyses = await this.getAnalyses();
    const documents = await this.getDocuments();
    const analysisIndex = analyses.findIndex((item) => item.id === analysis.id);
    if (analysisIndex >= 0) analyses[analysisIndex] = AnalysisSchema.parse(analysis);
    else analyses.unshift(AnalysisSchema.parse(analysis));
    documents.unshift(DocumentSchema.parse(document));
    this.writeTransaction([
      { filename: "analyses.json", data: AnalysisSchema.array().parse(analyses) },
      { filename: "documents.json", data: DocumentSchema.array().parse(documents) }
    ]);
  }

  async saveProcessedBioimpedance(_userId: string, profile: Profile, document: Document): Promise<void> {
    const documents = await this.getDocuments();
    documents.unshift(DocumentSchema.parse(document));
    this.writeTransaction([
      { filename: "profile.json", data: ProfileSchema.parse(profile) },
      { filename: "documents.json", data: DocumentSchema.array().parse(documents) }
    ]);
  }
}
