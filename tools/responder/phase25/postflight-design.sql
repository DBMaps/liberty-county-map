-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
Phase 25 production postflight contract. Inert design only; first executable in Phase 26 clone.

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';

-- Structural assertions:
-- exact 4 schemas, 23 enum types, 22 tables, required PK/FK/unique/check constraints;
-- deterministic indexes; RLS enabled and forced on all 22 tables; exact 17 policies;
-- 26 API wrappers + 26 private commands + 12 helpers/triggers = 64 functions;
-- every definer has search_path='', qualified objects, expected owner, no dynamic SQL;
-- PUBLIC/anon/service_role execute revocations and exact authenticated allowlists;
-- dispatch_api is the only new exposed schema; no raw private/audit/projection table grants;
-- static role, permission, and capability seeds match the signed manifest; zero fixture users.

-- Behavioral assertions in an isolated transaction/fixture namespace:
-- authenticated AAL2 succeeds only with live same-user verified TOTP and live session;
-- AAL1, stale/deleted user, removed factor, invalid signature, expiry, and tampering fail;
-- membership/org/scope/capability revocation denies on next request;
-- cross-organization reads/writes fail; platform admin does not inherit membership;
-- ownership recovery needs two distinct live platform actors and cannot forge publisher identity;
-- exact idempotent replay returns stored result; mismatched payload fails without mutation;
-- invitation digest/identity/expiry/revocation/concurrency/multi-org vectors pass;
-- audit/revisions are append-only; projection sanitation and every invalidation gate pass.

-- Preservation assertions:
-- preflight-to-postflight row counts/hashes for all out-of-scope production relations match;
-- consumer baseline and legacy 18-field compatibility output match approved fixtures;
-- reporting remains unchanged; Auth configuration/users are unchanged by migration;
-- production rows are preserved and compatibility reconciliation has zero unexplained variance.
ROLLBACK;
*/
-- PHASE25_INERT_SQL_END
