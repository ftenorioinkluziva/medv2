import { DatabasePort } from "../ports/DatabasePort";
import { FileStoragePort } from "../ports/FileStoragePort";
import { Result } from "../types/Result";
import { toOperationError } from "../types/errors";

export class GetDocumentFileUseCase {
  constructor(private readonly db: DatabasePort, private readonly files: FileStoragePort) {}

  async execute(userId: string, id: string): Promise<Result<{ filename: string; contents: Buffer }>> {
    try {
      const document = (await this.db.getDocuments(userId)).find((item) => item.id === id);
      if (!document) return { ok: false, error: {
        code: "DOCUMENT_NOT_FOUND",
        category: "validation",
        message: "Documento não encontrado.",
        retryable: false
      } };
      return { ok: true, value: {
        filename: document.originalName,
        contents: await this.files.read(document.filename)
      } };
    } catch (error) {
      return { ok: false, error: toOperationError(error, {
        code: "DOCUMENT_READ_FAILED",
        category: "internal",
        message: "Não foi possível ler o documento.",
        retryable: false
      }) };
    }
  }
}
