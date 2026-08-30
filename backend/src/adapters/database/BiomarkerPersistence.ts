import pg from "pg";
import { Analysis } from "../../core/schemas/analysis";
import { BiomarkerItem } from "../../core/schemas/biomarkers";

export function canonicalizeBiomarkerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "BIOMARKER_UNKNOWN";
}

export function parseNumericBiomarkerValue(value: BiomarkerItem["value"]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function persistStructuredBiomarkers(
  client: pg.PoolClient,
  userId: string,
  analysis: Analysis,
): Promise<void> {
  for (const biomarker of analysis.biomarkers) {
    const code = canonicalizeBiomarkerName(biomarker.name);
    const definition = await client.query<{ id: string }>(`
      INSERT INTO medv2_biomarker_definition(code, canonical_name, default_unit)
      VALUES ($1, $2, $3)
      ON CONFLICT (code) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        default_unit = CASE
          WHEN EXCLUDED.default_unit = '' THEN medv2_biomarker_definition.default_unit
          ELSE EXCLUDED.default_unit
        END,
        "updatedAt" = NOW()
      RETURNING id
    `, [code, biomarker.name.trim(), biomarker.unit]);
    const biomarkerId = definition.rows[0].id;
    await client.query(`
      INSERT INTO medv2_analysis_biomarker(
        "analysisId", "analysisVersion", "userId", "biomarkerId",
        value_numeric, value_text, unit, status, reference_range_text
      ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT ("analysisId", "analysisVersion", "biomarkerId") DO UPDATE SET
        value_numeric = EXCLUDED.value_numeric,
        value_text = EXCLUDED.value_text,
        unit = EXCLUDED.unit,
        status = EXCLUDED.status,
        reference_range_text = EXCLUDED.reference_range_text
    `, [analysis.id, userId, biomarkerId, parseNumericBiomarkerValue(biomarker.value), String(biomarker.value), biomarker.unit, biomarker.status, biomarker.referenceRange]);
  }
}
