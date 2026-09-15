\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';

WITH supplied AS (
  SELECT :'test_user_id'::uuid AS user_id, nullif(:'session_id', '')::uuid AS session_id
)
SELECT jsonb_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'subject_sha256_16', substr(encode(sha256(convert_to(s.user_id::text, 'UTF8')), 'hex'), 1, 16),
  'user_count', (SELECT count(*) FROM auth.users u WHERE u.id = s.user_id),
  'user_safe', (SELECT jsonb_build_object(
      'created_at', u.created_at,
      'confirmed_at', u.confirmed_at,
      'last_sign_in_at', u.last_sign_in_at,
      'deleted_at', u.deleted_at,
      'is_sso_user', u.is_sso_user,
      'is_anonymous', u.is_anonymous,
      'test_marker_matches', u.raw_app_meta_data ->> 'gridly_operator_test' = 'Gridly Responder Auth Verification Test'
    ) FROM auth.users u WHERE u.id = s.user_id),
  'sessions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'session_id', x.id,
      'created_at', x.created_at,
      'updated_at', x.updated_at,
      'factor_id', x.factor_id,
      'aal', x.aal,
      'not_after', x.not_after
    ) ORDER BY x.created_at)
    FROM auth.sessions x WHERE x.user_id = s.user_id), '[]'::jsonb),
  'requested_session_count', (SELECT count(*) FROM auth.sessions x
    WHERE x.user_id = s.user_id AND s.session_id IS NOT NULL AND x.id = s.session_id),
  'refresh_token_count', (SELECT count(*) FROM auth.refresh_tokens r WHERE r.user_id::text = s.user_id::text),
  'factors', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'factor_id', f.id,
      'factor_type', f.factor_type,
      'status', f.status,
      'created_at', f.created_at,
      'updated_at', f.updated_at,
      'last_challenged_at', f.last_challenged_at
    ) ORDER BY f.created_at)
    FROM auth.mfa_factors f WHERE f.user_id = s.user_id), '[]'::jsonb),
  'amr_claims', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'session_id', a.session_id,
      'authentication_method', a.authentication_method,
      'created_at', a.created_at,
      'updated_at', a.updated_at
    ) ORDER BY a.created_at)
    FROM auth.mfa_amr_claims a
    JOIN auth.sessions x ON x.id = a.session_id
    WHERE x.user_id = s.user_id AND (s.session_id IS NULL OR a.session_id = s.session_id)), '[]'::jsonb)
)::text
FROM supplied s;

ROLLBACK;
