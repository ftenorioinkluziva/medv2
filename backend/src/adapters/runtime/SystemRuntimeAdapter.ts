import crypto from "crypto";
import { RuntimePort } from "../../core/ports/RuntimePort";

export class SystemRuntimeAdapter implements RuntimePort {
  now(): Date {
    return new Date();
  }

  createId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }
}
