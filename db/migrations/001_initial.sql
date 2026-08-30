CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS session_user_id_idx ON session ("userId");
CREATE INDEX IF NOT EXISTS session_expires_at_idx ON session ("expiresAt");

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("providerId", "accountId")
);

CREATE INDEX IF NOT EXISTS account_user_id_idx ON account ("userId");

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medv2_profile (
  "userId" TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medv2_settings (
  "userId" TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medv2_document (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('blood-test', 'bioimpedance')),
  exam_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'staged',
  "originalName" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS medv2_document_user_date_idx ON medv2_document ("userId", exam_date DESC);

CREATE TABLE IF NOT EXISTS medv2_document_blob (
  "documentId" TEXT PRIMARY KEY REFERENCES medv2_document(id) ON DELETE CASCADE,
  "storageKey" TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'available', 'missing', 'quarantined')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medv2_analysis (
  id TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "documentId" TEXT REFERENCES medv2_document(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'completed',
  schema_version TEXT NOT NULL DEFAULT 'medv2-analysis/v1',
  input_fingerprint TEXT,
  model TEXT,
  lens TEXT,
  payload JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, version),
  UNIQUE ("userId", id, version)
);

CREATE INDEX IF NOT EXISTS medv2_analysis_user_date_idx ON medv2_analysis ("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS medv2_analysis_annotation (
  "analysisId" TEXT NOT NULL,
  "analysisVersion" INTEGER NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  annotations TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("analysisId", "analysisVersion"),
  FOREIGN KEY ("analysisId", "analysisVersion") REFERENCES medv2_analysis(id, version) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medv2_handoff_grant (
  "contractId" UUID PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  "createdAt" TIMESTAMPTZ NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "lastAccessedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS medv2_handoff_expiry_idx ON medv2_handoff_grant ("expiresAt");

CREATE TABLE IF NOT EXISTS medv2_operation (
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "idempotencyKey" TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error JSONB,
  attempt INTEGER NOT NULL DEFAULT 0,
  "leaseUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "idempotencyKey")
);

CREATE TABLE IF NOT EXISTS medv2_audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  outcome TEXT NOT NULL,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medv2_migration_issue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
