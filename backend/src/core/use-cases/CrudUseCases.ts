import { DatabasePort } from "../ports/DatabasePort";
import { Profile, ProfileSchema } from "../schemas/profile";
import { Settings, SettingsSchema } from "../schemas/settings";
import { Analysis } from "../schemas/analysis";
import { Document } from "../schemas/document";
import { SettingsUpdate } from "../schemas/operations";

export class GetProfileUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string): Promise<Profile> {
    return this.db.getProfile(userId);
  }
}

export class SaveProfileUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string, profile: Profile): Promise<void> {
    await this.db.saveProfile(userId, ProfileSchema.parse(profile));
  }
}

export class GetSettingsUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string): Promise<Settings> {
    return this.db.getSettings(userId);
  }
}

export class SaveSettingsUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string, settings: Settings): Promise<void> {
    await this.db.saveSettings(userId, SettingsSchema.parse(settings));
  }
}

export class UpdateSettingsUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string, input: SettingsUpdate): Promise<void> {
    const current = await this.db.getSettings(userId);
    const openrouterApiKey = input.openrouterApiKey && !input.openrouterApiKey.includes("•")
      ? input.openrouterApiKey
      : current.openrouterApiKey;
    await this.db.saveSettings(userId, SettingsSchema.parse({ ...current, ...input, openrouterApiKey }));
  }
}

export class GetAnalysesUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string): Promise<Analysis[]> {
    return this.db.getAnalyses(userId);
  }
}

export class GetBiomarkerHistoryUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string) {
    return this.db.getBiomarkerHistory(userId);
  }
}

export class GetAnalysisByIdUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string, id: string): Promise<Analysis | null> {
    return (await this.db.getAnalyses(userId)).find((analysis) => analysis.id === id) || null;
  }
}

export class SaveAnalysisUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string, analysis: Analysis): Promise<void> {
    const analyses = await this.db.getAnalyses(userId);
    const idx = analyses.findIndex(a => a.id === analysis.id);
    if (idx !== -1) {
      analyses[idx] = analysis;
    } else {
      analyses.unshift(analysis);
    }
    await this.db.saveAnalyses(userId, analyses);
  }
}

export class GetDocumentsUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string): Promise<Document[]> {
    return this.db.getDocuments(userId);
  }
}

export class SaveDocumentUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string, doc: Document): Promise<void> {
    const docs = await this.db.getDocuments(userId);
    docs.unshift(doc);
    await this.db.saveDocuments(userId, docs);
  }
}

export class UpdateAnalysisAnnotationsUseCase {
  constructor(private db: DatabasePort) {}
  async execute(userId: string, id: string, annotations: string): Promise<Analysis | null> {
    return this.db.updateAnalysisAnnotations(userId, id, annotations);
  }
}
