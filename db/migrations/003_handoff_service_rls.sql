DROP POLICY IF EXISTS medv2_handoff_owner ON medv2_handoff_grant;
CREATE POLICY medv2_handoff_owner ON medv2_handoff_grant
  USING ("userId" = current_setting('app.user_id', true) OR current_setting('app.service_access', true) = 'true')
  WITH CHECK ("userId" = current_setting('app.user_id', true));
