import { z } from "zod";

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["blood-test", "bioimpedance"]),
  date: z.string(),
  status: z.string().default("Processado"),
  filename: z.string(),
  originalName: z.string(),
  uploadedAt: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  sizeBytes: z.coerce.number().int().nonnegative().optional(),
  mimeType: z.string().default("application/pdf")
});

export type Document = z.infer<typeof DocumentSchema>;
