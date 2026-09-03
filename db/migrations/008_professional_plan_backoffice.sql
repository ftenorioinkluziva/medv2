ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient';

DO $$
BEGIN
  ALTER TABLE "user" ADD CONSTRAINT user_role_check CHECK (role IN ('patient', 'professional'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE medv2_audit_event
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT REFERENCES "user"(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS medv2_plan_revision (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "analysisId" TEXT NOT NULL,
  "analysisVersion" INTEGER NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  source TEXT NOT NULL CHECK (source IN ('manual')),
  payload JSONB NOT NULL,
  "createdBy" TEXT NOT NULL REFERENCES "user"(id),
  "publishedBy" TEXT REFERENCES "user"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "publishedAt" TIMESTAMPTZ,
  UNIQUE ("userId", "analysisId", "analysisVersion", version),
  FOREIGN KEY ("analysisId", "analysisVersion", "userId")
    REFERENCES medv2_analysis(id, version, "userId") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS medv2_plan_one_draft_idx
  ON medv2_plan_revision("userId", "analysisId", "analysisVersion")
  WHERE status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS medv2_plan_one_published_idx
  ON medv2_plan_revision("userId", "analysisId", "analysisVersion")
  WHERE status = 'published';

ALTER TABLE medv2_plan_revision ENABLE ROW LEVEL SECURITY;
ALTER TABLE medv2_plan_revision FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medv2_plan_revision_access ON medv2_plan_revision;
CREATE POLICY medv2_plan_revision_access ON medv2_plan_revision
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.user_role', true) = 'professional')
  WITH CHECK ("userId" = current_setting('app.user_id', true) OR current_setting('app.user_role', true) = 'professional');

DROP POLICY IF EXISTS medv2_audit_owner ON medv2_audit_event;
CREATE POLICY medv2_audit_owner ON medv2_audit_event
  USING (
    "userId" IS NULL
    OR "userId" = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'professional'
  )
  WITH CHECK (
    "userId" IS NULL
    OR "userId" = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'professional'
  );
