-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Auth users, verified identities, sessions, factors, and AMR evidence only.

BEGIN;

INSERT INTO dispatch_phase23_auth.auth_users(id,email_normalized,email_verified_at)
SELECT p.user_id,'user-'||replace(p.user_id::text,'-','')||'@dispatch.invalid',now()-interval '1 day'
FROM dispatch_phase21_local.profiles p;

INSERT INTO dispatch_phase23_auth.auth_identities
  (id,user_id,provider,provider_subject,email_normalized,email_verified_at)
SELECT gen_random_uuid(),u.id,'email',u.id::text,u.email_normalized,u.email_verified_at
FROM dispatch_phase23_auth.auth_users u;

INSERT INTO dispatch_phase23_auth.auth_sessions(id,user_id,issued_at,refreshed_at,expires_at,revoked_at)
SELECT session_id,auth_user_id,issued_at,issued_at,expires_at,revoked_at
FROM dispatch_phase22_local.synthetic_sessions;

INSERT INTO dispatch_phase23_auth.auth_sessions(id,user_id,issued_at,refreshed_at,expires_at)
VALUES ('a0000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000004',
  now()-interval '5 minutes',now()-interval '1 minute',now()+interval '1 hour');

INSERT INTO dispatch_phase23_auth.auth_factors
  (id,user_id,factor_type,status,secret_reference,enrolled_at,verified_at)
SELECT gen_random_uuid(),s.user_id,'totp','VERIFIED','local-opaque:'||s.id::text,
  s.issued_at-interval '1 minute',s.issued_at
FROM dispatch_phase23_auth.auth_sessions s
WHERE s.id NOT IN ('a0000000-0000-4000-8000-000000000012');

INSERT INTO dispatch_phase23_auth.auth_session_amr(session_id,method,factor_id,authenticated_at)
SELECT s.id,'totp',f.id,GREATEST(s.issued_at,f.verified_at)
FROM dispatch_phase23_auth.auth_sessions s
JOIN dispatch_phase23_auth.auth_factors f ON f.secret_reference='local-opaque:'||s.id::text;

INSERT INTO dispatch_phase23_auth.auth_session_amr(session_id,method,factor_id,authenticated_at)
SELECT id,'password',NULL,issued_at FROM dispatch_phase23_auth.auth_sessions;

-- The former Phase 22 "stale MFA" vector becomes an actually expired Auth session.
UPDATE dispatch_phase23_auth.auth_sessions
SET expires_at=statement_timestamp()-interval '1 second'
WHERE id='a0000000-0000-4000-8000-000000000013';

INSERT INTO dispatch_phase23_auth.auth_security_events(user_id,session_id,event_type)
SELECT user_id,id,'LOGIN' FROM dispatch_phase23_auth.auth_sessions;
INSERT INTO dispatch_phase23_auth.auth_security_events(user_id,factor_id,event_type)
SELECT user_id,id,'FACTOR_VERIFIED' FROM dispatch_phase23_auth.auth_factors;

COMMIT;
