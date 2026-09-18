# Phase 25 production-shaped neutral migration package design

**DESIGN ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION**

This directory specifies the future Gridly Dispatch database package derived
from the frozen Phase 20 contract and the Phase 21–24 local proofs. It is not a
Supabase migration, is intentionally outside `supabase/migrations`, contains no
deployment runner, and must not be applied to any database.

Target schemas:

- `dispatch_private`: private current state, authorization, and command internals.
- `dispatch_audit`: immutable revisions, receipts, and business audit evidence.
- `dispatch_projection`: private candidate and public-safe projection storage.
- `dispatch_api`: the only Dispatch schema recommended for Data API exposure.

All `*.sql` files are inert specifications enclosed in block comments. Phase 26
must manufacture a separate executable rehearsal package from these designs,
apply it only to a disposable production-shaped clone, and prove equivalence by
hashes and catalog assertions. Nothing in Phase 25 may be copied into a live
migration without that rehearsal and separate owner authorization.

Package contents:

- `migration-plan.md`: inventory, ordering, retention classes, and gates.
- `schema-design.sql`: exact types, tables, constraints, and index intent.
- `rls-design.sql`: table access classifications and representative policies.
- `commands-design.sql`: exact command/RPC contract inventory.
- `grants-design.sql`: roles, default privileges, and Data API exposure.
- `compatibility-design.sql`: responder-era mapping and conditional coexistence.
- `preflight-design.sql`: read-only preflight assertions.
- `postflight-design.sql`: read-only structural and security assertions.
- `rollback-design.sql`: rollback modes and refusal rules.
- `owner-decisions.md`: explicit owner decision register.
- `package-lint.mjs`: offline safety and frozen-inventory validation.
- `package-lint.mjs`: offline safety and frozen-inventory validation.

Validate locally without a database connection:

```powershell
node --test tests/responder-phase25-production-shaped-neutral-migration-design.test.mjs
```
