import { z } from "zod";

export const IdempotencyKeySchema = z.string().trim().min(8).max(200);
export const AuthUserIdSchema = z.string().trim().min(1).max(200);

export const OperationStatusSchema = z.enum(["pending", "processing", "completed", "failed"]);

export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
