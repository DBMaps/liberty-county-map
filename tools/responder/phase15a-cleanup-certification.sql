\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';

WITH supplied AS (
  SELECT :'test_user_id'::uuid AS user_id
), exact_counts AS (
  SELECT
    (SELECT count(*) FROM auth.users u WHERE u.id = s.user_id) AS user_count,
    (SELECT count(*) FROM auth.sessions x WHERE x.user_id = s.user_id) AS session_count,
    (SELECT count(*) FROM auth.refresh_tokens r WHERE r.user_id::text = s.user_id::text) AS refresh_token_count,
    (SELECT count(*) FROM auth.mfa_factors f WHERE f.user_id = s.user_id) AS factor_count,
    (SELECT count(*)
       FROM auth.mfa_amr_claims a
       JOIN auth.sessions x ON x.id = a.session_id
      WHERE x.user_id = s.user_id) AS amr_claim_count
  FROM supplied s
)
SELECT jsonb_build_object(
  'mode', 'CertifyCleanup',
  'transaction_read_only', current_setting('transaction_read_only'),
  'user_count', c.user_count,
  'session_count', c.session_count,
  'refresh_token_count', c.refresh_token_count,
  'factor_count', c.factor_count,
  'amr_claim_count', c.amr_claim_count,
  'cleanup_certified', c.user_count = 0 AND c.session_count = 0
    AND c.refresh_token_count = 0 AND c.factor_count = 0 AND c.amr_claim_count = 0
)::text
FROM exact_counts c;

ROLLBACK;
