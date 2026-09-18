-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
Phase 25 responder-era compatibility design. This entire file is inert commentary.
PHASE25_EXPECTED_COMPATIBILITY_DECISION_COUNT=13

1 REUSE DIRECTLY | auth.uid()/live session/factor predicates | preserve proven Auth semantics.
2 REUSE DIRECTLY | shared governed county identifiers | reference only after fresh collision/integrity preflight.
3 DATA MIGRATION | agency organizations -> organizations | explicit IDs and vocabulary mapping; never rename blindly.
4 DATA MIGRATION | agency principals/memberships -> profiles/memberships | preserve history and actor IDs.
5 DATA MIGRATION | county authority -> scoped capability grants | county scope plus explicit capability, not a badge.
6 DATA MIGRATION | agency operational current state -> operational_records | validate type/state mapping and revision pointer.
7 DATA MIGRATION | responder revisions/events -> record_revisions/audit_events | retain original actor/time/source vocabulary.
8 DATA MIGRATION | responder receipts/audit -> neutral receipts/audit | preserve token domain and evidence chain.
9 COMPATIBILITY VIEW/WRAPPER | exact legacy 18-field public projection | safe neutral projection adapter only.
10 COMPATIBILITY VIEW/WRAPPER | responder RPC names | map frozen inputs/results to neutral commands; no weaker authorization.
11 SUPERSEDE | legacy sector-specific RLS and Phase 17 package | reference evidence only; do not deploy or rename.
12 SUPERSEDE | responder dashboard | neutral Dispatch UI is a later phase; no Phase 25 UI change.
13 RETIRE | fixture identities and synthetic tokens | never migrate to production.

Preflight modes:
ABSENT: install neutral package only; compatibility objects require explicit consumer need.
EMPTY: prove zero rows and dependencies; neutral package only, optional separately approved aliases.
POPULATED_OR_REFERENCED: coexist, snapshot, map IDs/vocabulary, backfill, reconcile counts/hashes,
  validate dual reads and authorization, switch compatibility layer, observe, then retire only by approval.

Role mapping is frozen: VIEWER->VIEWER, RESPONDER->OPERATOR,
SUPERVISOR->SUPERVISOR, AGENCY_ADMIN->ORGANIZATION_ADMIN.
AGENCY_OFFICIAL remains immutable historical source vocabulary. The legacy 18-field projection
shape is exact compatibility output, not the neutral storage schema. No destructive rename,
drop, enum rewrite, or ownership reassignment occurs without production inventory, clone
rehearsal, owner approval, backup evidence, and a data-bearing rollback decision.
*/
-- PHASE25_INERT_SQL_END
