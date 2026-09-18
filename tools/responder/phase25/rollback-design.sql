-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
Phase 25 rollback design. Inert; no DROP or mutation is executable from this file.

PRE_DATA mode (only before any user/synthetic data):
  require exact installed package hash, deployment journal, zero rows, zero dependencies,
  and owner approval; revoke API grants, remove compatibility objects, functions, policies,
  tables, types, and schemas in strict reverse order. Restore prior Data API configuration.

POST_SYNTHETIC_DATA mode (disposable clone only):
  verify every row is registered Phase 26 fixture data, remove fixtures through their owning
  commands, reconcile zero rows/dependencies, then use PRE_DATA. Never classify real rows by
  naming convention alone.

POST_REAL_DATA mode:
  destructive DROP is forbidden. Freeze command entry points, revoke exposed execution,
  retain schemas/data/audit/receipts, restore versioned prior functions/policies/grants and
  compatibility routing, validate reads, and perform an owner-approved forward repair.
  If write compatibility is impossible, enter read-only incident mode and preserve evidence.

Reversible: function/policy/view/grant/Data API configuration changes when their exact prior
definitions were captured and clone-tested. Conditionally reversible: static seeds and empty
new objects. Irreversible without a verified restore: backfills, ID/vocabulary translations,
enum rewrites, data deletion/pseudonymization, legacy retirement, and Auth identity changes.

Refusal guards: unknown environment; missing/mismatched package hash; nonzero or uncertain row
counts; unexpected dependencies; absent restorable backup; missing pre-state definitions;
active clients; incomplete audit export; or any production inventory drift. Any guard means
stop and escalate—never improvise DROP CASCADE, truncate, or reverse migration.
*/
-- PHASE25_INERT_SQL_END
