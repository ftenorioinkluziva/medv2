export interface RuntimePort {
  now(): Date;
  createId(prefix: string): string;
}
