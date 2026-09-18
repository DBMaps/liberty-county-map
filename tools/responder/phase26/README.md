# Phase 26 neutral production-shaped clone rehearsal

**LOCAL DISPOSABLE REHEARSAL ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION**

This package manufactures and exercises the inert Phase 25 design against a
temporary, unlinked, loopback-only Supabase stack with synthetic data. It is
outside `supabase/migrations` and must never be used against a remote database.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/responder/phase26/run-clone-rehearsal.ps1
```

Stages are baseline, preflight, apply, postflight, Auth/RLS/command vectors,
failure injection, pre-data rollback, evidence-bearing rollback refusal,
reapply, catalog certification, and teardown. Runtime evidence is written to
`reports/responder/phase26-evidence/`; it contains no credentials or Auth tokens.

Package files:

- `baseline.sql`: synthetic production-shaped sentinels.
- `preflight.sql`: fail-closed local identity and collision checks.
- `apply.sql`: executable neutral rehearsal package.
- `seed-static-contract.sql`: deterministic frozen authorization seeds.
- `compatibility.sql`: isolated legacy projection compatibility relation.
- `postflight.sql`: exact catalog and preservation assertions.
- `rollback.sql`: empty-data rollback with evidence refusal.
- `catalog-snapshot.mjs`: canonicalizes and hashes catalog JSON.
- `rehearsal-runtime.test.mjs`: live local Auth/database integration vectors.
- `run-clone-rehearsal.ps1`: disposable stack lifecycle and teardown proof.

No production connection material, project reference, user, or data is used.
