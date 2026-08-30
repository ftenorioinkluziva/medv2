import { DatabasePort } from "../ports/DatabasePort";
import { FileStoragePort } from "../ports/FileStoragePort";
import { RuntimePort } from "../ports/RuntimePort";
import { Analysis } from "../schemas/analysis";
import { createHash } from "node:crypto";
import { Document, DocumentSchema } from "../schemas/document";
import { DocumentType } from "../schemas/operations";
import { Profile, ProfileSchema } from "../schemas/profile";
import { Result } from "../types/Result";
import { toOperationError } from "../types/errors";
import { calculateMarkers } from "../utils/biomarkerCalculations";
import { GenerateAnalysisUseCase } from "./GenerateAnalysisUseCase";
import { ParseDocumentUseCase } from "./ParseDocumentUseCase";

export interface ProcessDocumentInput {
  type: DocumentType;
  originalName: string;
  contents: Buffer;
}

export interface ProcessDocumentOutput {
  message: string;
  document: Document;
  documents: Document[];
  profile?: Profile;
  analysis?: Analysis;
  analyses?: Analysis[];
}

export class ProcessDocumentUseCase {
  constructor(
    private readonly parser: ParseDocumentUseCase,
    private readonly analysisGenerator: GenerateAnalysisUseCase,
    private readonly db: DatabasePort,
    private readonly files: FileStoragePort,
    private readonly runtime: RuntimePort
  ) {}

  async execute(userId: string, input: ProcessDocumentInput): Promise<Result<ProcessDocumentOutput>> {
    let storedFilename: string | null = null;
    try {
      const profile = await this.db.getProfile(userId);
      const id = this.runtime.createId("doc");
      storedFilename = `${id}.pdf`;

      if (input.type === "bioimpedance") {
        const parsed = await this.parser.parseBioimpedance(userId, input.contents);
        if (!parsed.ok) return parsed;
        const updatedProfile = ProfileSchema.parse({
          ...profile,
          altura: parsed.value.altura ?? profile.altura,
          peso: parsed.value.peso ?? profile.peso,
          massaMagra: parsed.value.massaMagra ?? profile.massaMagra,
          imc: parsed.value.imc ?? profile.imc,
          inbodyScore: parsed.value.inbodyScore ?? profile.inbodyScore
        });
        const document = this.createDocument(id, storedFilename, input.originalName, input.type, parsed.value.dataExame, input.contents);
        await this.files.save(storedFilename, input.contents);
        await this.db.saveProcessedBioimpedance(userId, updatedProfile, document);
        return { ok: true, value: {
          message: "Bioimpedância processada com sucesso! Seu perfil foi atualizado.",
          document,
          documents: await this.db.getDocuments(userId),
          profile: updatedProfile
        } };
      }

      const parsed = await this.parser.parseBloodTest(userId, input.contents);
      if (!parsed.ok) return parsed;
      const examDate = parsed.value.date || this.runtime.now().toISOString().split("T")[0];
      const biomarkers = calculateMarkers(parsed.value.biomarkers, profile.idade);
      const generated = await this.analysisGenerator.execute(userId, biomarkers, examDate, input.originalName);
      if (!generated.ok) return generated;
      const document = this.createDocument(id, storedFilename, input.originalName, input.type, examDate, input.contents);
      await this.files.save(storedFilename, input.contents);
      await this.db.saveProcessedBloodTest(userId, generated.value, document);
      return { ok: true, value: {
        message: "Exame de sangue analisado com sucesso! Nova análise e planos gerados.",
        document,
        documents: await this.db.getDocuments(userId),
        analysis: generated.value,
        analyses: await this.db.getAnalyses(userId)
      } };
    } catch (error) {
      if (storedFilename) await this.files.remove(storedFilename);
      return { ok: false, error: toOperationError(error, {
        code: "DOCUMENT_PROCESSING_FAILED",
        category: "internal",
        message: "Não foi possível concluir o processamento do documento.",
        retryable: false
      }) };
    }
  }

  private createDocument(
    id: string,
    filename: string,
    originalName: string,
    type: DocumentType,
    date: string | null,
    contents: Buffer
  ): Document {
    return DocumentSchema.parse({
      id,
      name: originalName,
      type,
      date: date || this.runtime.now().toISOString().split("T")[0],
      status: "Processado",
      filename,
      originalName,
      uploadedAt: this.runtime.now().toISOString(),
      sha256: createHash("sha256").update(contents).digest("hex"),
      sizeBytes: contents.byteLength,
      mimeType: "application/pdf"
    });
  }
}
