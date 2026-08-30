import { z } from "zod";

export const HandoffGrantSchema = z.object({
  contractId: z.string().uuid(),
  subject: z.string().min(1),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastAccessedAt: z.string().datetime().optional()
});

export type HandoffGrant = z.infer<typeof HandoffGrantSchema>;

export const WorkoutContractSchema = z.object({
  contractVersion: z.literal("medv0-opengym-workout/v1"),
  contractId: z.string().uuid(),
  source: z.literal("medv0"),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  clinicalAnalysis: z.object({
    agentName: z.string(),
    analysisId: z.string(),
    livingAnalysisVersionId: z.string(),
    analysisVersion: z.number().int().positive(),
    status: z.literal("completed")
  }),
  prescription: z.object({
    objective: z.string(),
    restrictions: z.array(z.string()),
    alerts: z.array(z.unknown()),
    progression: z.array(z.unknown()),
    sessions: z.array(z.object({
      day: z.string(),
      type: z.enum(["cardio", "strength"]),
      title: z.string(),
      order: z.number().int().positive(),
      warmup: z.unknown(),
      cooldown: z.unknown(),
      items: z.array(z.unknown())
    }))
  }),
  catalog: z.object({ provider: z.literal("opengym"), version: z.string() }),
  audit: z.object({ mappingHistory: z.array(z.unknown()), sourceProductId: z.string() })
});

export type WorkoutContract = z.infer<typeof WorkoutContractSchema>;
