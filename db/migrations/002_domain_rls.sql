DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['medv2_profile', 'medv2_settings', 'medv2_document', 'medv2_document_blob', 'medv2_analysis', 'medv2_analysis_annotation', 'medv2_handoff_grant', 'medv2_operation', 'medv2_audit_event']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

CREATE POLICY medv2_profile_owner ON medv2_profile
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY medv2_settings_owner ON medv2_settings
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY medv2_document_owner ON medv2_document
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY medv2_blob_owner ON medv2_document_blob
  USING (EXISTS (SELECT 1 FROM medv2_document d WHERE d.id = "documentId" AND d."userId" = current_setting('app.user_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM medv2_document d WHERE d.id = "documentId" AND d."userId" = current_setting('app.user_id', true)));

CREATE POLICY medv2_analysis_owner ON medv2_analysis
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY medv2_annotation_owner ON medv2_analysis_annotation
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY medv2_handoff_owner ON medv2_handoff_grant
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.service_access', true) = 'true')
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY medv2_operation_owner ON medv2_operation
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY medv2_audit_owner ON medv2_audit_event
  USING ("userId" IS NULL OR "userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" IS NULL OR "userId" = current_setting('app.user_id', true));
