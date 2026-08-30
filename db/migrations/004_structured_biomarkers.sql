CREATE TABLE IF NOT EXISTS medv2_biomarker_definition (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  category TEXT,
  default_unit TEXT NOT NULL DEFAULT '',
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT medv2_biomarker_aliases_array CHECK (jsonb_typeof(aliases) = 'array')
);

CREATE TABLE IF NOT EXISTS medv2_reference_range (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "biomarkerId" UUID NOT NULL REFERENCES medv2_biomarker_definition(id) ON DELETE CASCADE,
  sex TEXT,
  age_min INTEGER,
  age_max INTEGER,
  min_value NUMERIC,
  max_value NUMERIC,
  version TEXT NOT NULL,
  source TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT medv2_reference_range_age CHECK (age_min IS NULL OR age_min >= 0),
  CONSTRAINT medv2_reference_range_age_order CHECK (age_max IS NULL OR age_min IS NULL OR age_max >= age_min),
  CONSTRAINT medv2_reference_range_value_order CHECK (min_value IS NULL OR max_value IS NULL OR max_value >= min_value),
  CONSTRAINT medv2_reference_range_sex CHECK (sex IS NULL OR sex IN ('female', 'male', 'other', 'any'))
);

CREATE INDEX IF NOT EXISTS medv2_reference_range_lookup_idx
  ON medv2_reference_range ("biomarkerId", sex, age_min, age_max, active);

ALTER TABLE medv2_analysis
  ADD CONSTRAINT medv2_analysis_id_version_user_unique UNIQUE (id, version, "userId");

CREATE TABLE IF NOT EXISTS medv2_analysis_biomarker (
  "analysisId" TEXT NOT NULL,
  "analysisVersion" INTEGER NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "biomarkerId" UUID NOT NULL REFERENCES medv2_biomarker_definition(id) ON DELETE RESTRICT,
  value_numeric NUMERIC,
  value_text TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'alto', 'baixo', 'alterado')),
  reference_range_text TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("analysisId", "analysisVersion", "biomarkerId"),
  FOREIGN KEY ("analysisId", "analysisVersion", "userId")
    REFERENCES medv2_analysis(id, version, "userId") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS medv2_analysis_biomarker_history_idx
  ON medv2_analysis_biomarker ("userId", "biomarkerId", "createdAt" DESC);

ALTER TABLE medv2_analysis_biomarker ENABLE ROW LEVEL SECURITY;
ALTER TABLE medv2_analysis_biomarker FORCE ROW LEVEL SECURITY;

CREATE POLICY medv2_analysis_biomarker_owner ON medv2_analysis_biomarker
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));
