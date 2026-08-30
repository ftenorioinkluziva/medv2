CREATE TABLE IF NOT EXISTS medv2_workout_task_completion (
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "analysisId" TEXT NOT NULL,
  weekday TEXT NOT NULL,
  "taskKey" TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  "completedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "analysisId", weekday, "taskKey")
);

CREATE INDEX IF NOT EXISTS medv2_workout_completion_lookup_idx
  ON medv2_workout_task_completion ("userId", "analysisId", weekday);

ALTER TABLE medv2_workout_task_completion ENABLE ROW LEVEL SECURITY;
ALTER TABLE medv2_workout_task_completion FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medv2_workout_task_completion_owner ON medv2_workout_task_completion;
CREATE POLICY medv2_workout_task_completion_owner ON medv2_workout_task_completion
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));
