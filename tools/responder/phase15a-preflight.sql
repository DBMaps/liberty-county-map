\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';

SELECT jsonb_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'project_ref_matches', COALESCE((
    SELECT project_ref = :'project_ref'
    FROM gridly_control.prelaunch_reset_authorization
    WHERE singleton
  ), false),
  'reporting_enabled', COALESCE((
    SELECT bool_or(reporting_enabled)
    FROM report_retention.admission_state
    WHERE singleton AND protocol_version = 2
  ), true),
  'agency_private_present', to_regnamespace('agency_private') IS NOT NULL,
  'responder_public_present', to_regnamespace('responder_public') IS NOT NULL,
  'agency_publishing_object_count', (
    SELECT count(*)
    FROM information_schema.columns
    WHERE column_name = 'agency_publishing_enabled'
  ),
  'test_email_match_count', (
    SELECT count(*) FROM auth.users WHERE lower(email) = lower(:'test_email')
  ),
  'marked_test_user_count', (
    SELECT count(*) FROM auth.users
    WHERE lower(email) = lower(:'test_email')
      AND raw_app_meta_data ->> 'gridly_operator_test' = 'Gridly Responder Auth Verification Test'
  ),
  'recovery_user_id', (
    SELECT CASE WHEN count(*) = 1 THEN min(id::text) ELSE NULL END
    FROM auth.users
    WHERE lower(email) = lower(:'test_email')
      AND raw_app_meta_data ->> 'gridly_operator_test' = 'Gridly Responder Auth Verification Test'
  ),
  'auth_counts', jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'sessions', (SELECT count(*) FROM auth.sessions),
    'refresh_tokens', (SELECT count(*) FROM auth.refresh_tokens),
    'mfa_factors', (SELECT count(*) FROM auth.mfa_factors),
    'mfa_amr_claims', (SELECT count(*) FROM auth.mfa_amr_claims)
  )
)::text;

ROLLBACK;
