import fs from "fs/promises";
import path from "path";
import { FileStoragePort } from "../../core/ports/FileStoragePort";
import { OperationFailure } from "../../core/types/errors";

export class LocalFileStorageAdapter implements FileStoragePort {
  constructor(private readonly directory: string) {}

  private resolve(filename: string): string {
    if (!filename || path.basename(filename) !== filename) {
      throw new OperationFailure({
        code: "INVALID_FILENAME",
        category: "validation",
        message: "Nome de arquivo inválido.",
        retryable: false
      });
    }
    return path.join(this.directory, filename);
  }

  async save(filename: string, contents: Buffer): Promise<void> {
    let temporary: string | null = null;
    try {
      await fs.mkdir(this.directory, { recursive: true });
      const target = this.resolve(filename);
      temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(temporary, contents, { flag: "wx" });
      await fs.rename(temporary, target);
    } catch (error) {
      if (temporary) await fs.rm(temporary, { force: true }).catch(() => undefined);
      if (error instanceof OperationFailure) throw error;
      throw new OperationFailure({
        code: "FILE_WRITE_FAILED",
        category: "internal",
        message: "Não foi possível armazenar o documento.",
        retryable: false
      }, { cause: error });
    }
  }

  async read(filename: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolve(filename));
    } catch (error) {
      if (error instanceof OperationFailure) throw error;
      throw new OperationFailure({
        code: "FILE_NOT_FOUND",
        category: "validation",
        message: "Documento não encontrado.",
        retryable: false
      }, { cause: error });
    }
  }

  async remove(filename: string): Promise<void> {
    try {
      await fs.rm(this.resolve(filename), { force: true });
    } catch {
      // Compensation is best effort and must not mask the original failure.
    }
  }
}
