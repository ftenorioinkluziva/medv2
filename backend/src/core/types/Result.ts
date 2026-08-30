import { OperationError } from "./errors";

export type Result<T, E = OperationError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
