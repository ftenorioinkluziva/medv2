import { z } from "zod";

export const BiomarkerItemSchema = z.object({
  name: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().nullish().transform(val => val || ""),
  referenceRange: z.string().nullish().transform(val => val || ""),
  status: z.enum(["normal", "alto", "baixo", "alterado"]).nullish().transform(val => val || "normal")
});

export const BloodTestResultSchema = z.object({
  date: z.string().nullable().default(null),
  biomarkers: z.array(BiomarkerItemSchema).default([])
});

export const BioimpedanceResultSchema = z.object({
  dataExame: z.string().nullable().default(null),
  altura: z.coerce.number().nullable().default(null),
  peso: z.coerce.number().nullable().default(null),
  massaMagra: z.coerce.number().nullable().default(null),
  imc: z.coerce.number().nullable().default(null),
  inbodyScore: z.coerce.number().nullable().default(null),
  percentualGordura: z.coerce.number().nullable().default(null),
  massaGordura: z.coerce.number().nullable().default(null),
  aguaCorporal: z.coerce.number().nullable().default(null),
  proteina: z.coerce.number().nullable().default(null),
  minerais: z.coerce.number().nullable().default(null),
  taxaMetabolicaBasal: z.coerce.number().nullable().default(null),
  relacaoCinturaQuadril: z.coerce.number().nullable().default(null),
  nivelGorduraVisceral: z.coerce.number().nullable().default(null)
});

export type BiomarkerItem = z.infer<typeof BiomarkerItemSchema>;
export type BloodTestResult = z.infer<typeof BloodTestResultSchema>;
export type BioimpedanceResult = z.infer<typeof BioimpedanceResultSchema>;
