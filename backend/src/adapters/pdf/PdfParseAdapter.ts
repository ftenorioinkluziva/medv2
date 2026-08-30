// @ts-ignore
import pdf from "pdf-parse";
import { PDFParserPort } from "../../core/ports/PDFParserPort";
import { OperationFailure } from "../../core/types/errors";

export class PdfParseAdapter implements PDFParserPort {
  async extractText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      return data.text;
    } catch (err: any) {
      throw new OperationFailure({
        code: "PDF_PARSE_FAILED",
        category: "validation",
        message: "O arquivo enviado não pôde ser interpretado como PDF.",
        retryable: false
      }, { cause: err });
    }
  }
}
