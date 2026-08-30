export interface PDFParserPort {
  extractText(buffer: Buffer): Promise<string>;
}
