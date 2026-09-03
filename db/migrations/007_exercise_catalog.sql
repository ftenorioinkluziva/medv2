CREATE TABLE IF NOT EXISTS medv2_exercise (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  body_part TEXT,
  equipment TEXT,
  target TEXT,
  primary_muscle TEXT,
  secondary_muscles JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions_pt JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_key TEXT NOT NULL DEFAULT 'local-catalog',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT medv2_exercise_secondary_muscles_array CHECK (jsonb_typeof(secondary_muscles) = 'array'),
  CONSTRAINT medv2_exercise_instructions_array CHECK (jsonb_typeof(instructions) = 'array'),
  CONSTRAINT medv2_exercise_instructions_pt_array CHECK (jsonb_typeof(instructions_pt) = 'array')
);

CREATE INDEX IF NOT EXISTS medv2_exercise_name_idx ON medv2_exercise (LOWER(name));
CREATE INDEX IF NOT EXISTS medv2_exercise_body_part_idx ON medv2_exercise (body_part);
CREATE INDEX IF NOT EXISTS medv2_exercise_target_idx ON medv2_exercise (target);

CREATE TABLE IF NOT EXISTS medv2_exercise_media (
  "exerciseId" TEXT NOT NULL REFERENCES medv2_exercise(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'animation')),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/gif')),
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  content BYTEA NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("exerciseId", kind),
  UNIQUE (kind, filename)
);

CREATE INDEX IF NOT EXISTS medv2_exercise_media_lookup_idx
  ON medv2_exercise_media ("exerciseId", kind);

ALTER TABLE medv2_exercise ENABLE ROW LEVEL SECURITY;
ALTER TABLE medv2_exercise FORCE ROW LEVEL SECURITY;
ALTER TABLE medv2_exercise_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE medv2_exercise_media FORCE ROW LEVEL SECURITY;

CREATE POLICY medv2_exercise_catalog_access ON medv2_exercise
  FOR ALL
  USING (TRUE)
  WITH CHECK (current_setting('app.exercise_catalog_write', true) = 'true');

CREATE POLICY medv2_exercise_media_access ON medv2_exercise_media
  FOR ALL
  USING (TRUE)
  WITH CHECK (current_setting('app.exercise_catalog_write', true) = 'true');
