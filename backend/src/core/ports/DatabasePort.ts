import { Profile } from "../schemas/profile";
import { Settings } from "../schemas/settings";
import { Analysis } from "../schemas/analysis";
import { Document } from "../schemas/document";
import { StructuredBiomarkerHistory } from "../schemas/biomarker-history";
import { Weekday, WorkoutTaskCompletion } from "../schemas/workout-checklist";

export interface DatabasePort {
  getProfile(userId: string): Promise<Profile>;
  saveProfile(userId: string, profile: Profile): Promise<void>;
  getSettings(userId: string): Promise<Settings>;
  saveSettings(userId: string, settings: Settings): Promise<void>;
  getAnalyses(userId: string): Promise<Analysis[]>;
  getBiomarkerHistory(userId: string): Promise<StructuredBiomarkerHistory[]>;
  saveAnalyses(userId: string, analyses: Analysis[]): Promise<void>;
  getDocuments(userId: string): Promise<Document[]>;
  getWorkoutTaskCompletions(userId: string, analysisId: string, weekday: Weekday): Promise<WorkoutTaskCompletion[]>;
  saveWorkoutTaskCompletion(userId: string, completion: WorkoutTaskCompletion): Promise<void>;
  saveDocuments(userId: string, documents: Document[]): Promise<void>;
  updateAnalysisAnnotations(userId: string, id: string, annotations: string): Promise<Analysis | null>;
  saveProcessedBloodTest(userId: string, analysis: Analysis, document: Document): Promise<void>;
  saveProcessedBioimpedance(userId: string, profile: Profile, document: Document): Promise<void>;
}
