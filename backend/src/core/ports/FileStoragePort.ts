export interface FileStoragePort {
  save(filename: string, contents: Buffer): Promise<void>;
  read(filename: string): Promise<Buffer>;
  remove(filename: string): Promise<void>;
}
