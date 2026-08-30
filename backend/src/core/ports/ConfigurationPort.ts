import { Settings } from "../schemas/settings";

export type AnalysisConfiguration = Omit<Settings, "openrouterApiKey">;

export interface AnalysisConfigurationPort {
  getAnalysisConfiguration(userId: string): Promise<AnalysisConfiguration>;
}

export interface OpenRouterCredentialPort {
  getOpenRouterApiKey(userId?: string): Promise<string>;
}
