-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
Phase 25 production preflight contract. This is inert and MUST first run on a disposable,
production-shaped Phase 26 clone. A later deployment operator must manufacture executable
SQL with an approved expected-environment manifest; this file must never be pasted as-is.
PHASE25_UNRESOLVED_PRODUCTION_VERIFICATION_COUNT=14

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';

-- Fail unless all operator-supplied, non-secret expectations match:
-- 01 database/project identity fingerprint and approved hostname class
-- 02 migration actor identity, privileges, NOLOGIN function-owner existence
-- 03 current migration head and complete applied-migration hash
-- 04 PostgreSQL version range and extension names/versions/schemas
-- 05 schema/table/type/constraint/index inventory hash and collision report
-- 06 function signature/owner/security/search_path/ACL inventory hash
-- 07 RLS enabled/forced, policy, relation ACL, and default-privilege inventory
-- 08 Data API exposed-schema list; private Dispatch schemas must be absent
-- 09 Auth schema capability: users, sessions, MFA factors/challenges, AAL/AMR behavior
-- 10 responder-era mode: ABSENT, EMPTY, or POPULATED_OR_REFERENCED plus dependencies/counts
-- 11 zero Dispatch user-data assumption, or approved explicit data migration plan
-- 12 consumer/public/native health and exact legacy 18-field projection baseline
-- 13 reporting state remains unchanged/disabled and no reporting objects collide
-- 14 verified restorable backup, rollback package/hash, rehearsal certificate, approvals

SELECT session_user, current_user, current_database(), current_setting('transaction_read_only');
SELECT nspname FROM pg_namespace ORDER BY nspname;
SELECT schemaname, tablename, tableowner FROM pg_tables ORDER BY 1,2;
SELECT n.nspname, p.proname, p.prosecdef, p.proconfig, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
ORDER BY 1,2;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies ORDER BY 1,2,3;
SELECT extname, extversion, n.nspname FROM pg_extension e
JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY extname;

-- External gates cannot be proven by SQL: backup restoration, consumer health, Auth redirect
-- and email-link configuration, CSP/CORS, service-worker behavior, owner sign-off, and the
-- Phase 26 signed artifact manifest. Missing or ambiguous evidence is NO-GO.
ROLLBACK;
*/
-- PHASE25_INERT_SQL_END
