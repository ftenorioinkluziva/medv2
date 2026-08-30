export interface OperationError {
  code: string;
  category: "validation" | "authorization" | "conflict" | "rate_limit" | "upstream" | "internal";
  message: string;
  hint?: string;
  retryable: boolean;
  invalidFields?: string[];
}

export class OperationFailure extends Error {
  constructor(public readonly operationError: OperationError, options?: ErrorOptions) {
    super(operationError.message, options);
    this.name = "OperationFailure";
  }
}

export function isOperationError(value: unknown): value is OperationError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OperationError>;
  return typeof candidate.code === "string"
    && typeof candidate.category === "string"
    && typeof candidate.message === "string"
    && typeof candidate.retryable === "boolean";
}

export function toOperationError(
  error: unknown,
  fallback: OperationError
): OperationError {
  if (error instanceof OperationFailure) return error.operationError;
  if (isOperationError(error)) return error;
  return fallback;
}
