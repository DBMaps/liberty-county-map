# Responder V1 Phase 17 — Future Production Migration Runbook

Status: **NOT AUTHORIZED FOR EXECUTION**. This is an owner-review package, not approval.

## 1. Prerequisites

- Work only from the owner-approved responder deployment branch/commit; never the protected LP244.26 worktree.
- Install the current Supabase CLI and read `supabase --help`, `supabase migration --help`, `supabase migration new --help`, `supabase migration list --help`, and `supabase db push --help`.
- Authenticate and link only project `nhwhkbkludzkuyxmkkcj`; independently verify the linked project.
- Use one named operator and the `postgres` migration principal. Do not use a browser/service key as a database migration credential.
- Have the approved Phase 17 manifest and package SHA values in hand.
- Rehearse on a non-production clone matching PostgreSQL 17.6, PostGIS 3.3.7, Auth catalog, roles, grants, county table, and migration history.
- Keep `reporting_enabled=false`; do not create responder users, organizations, memberships, grants, authorities, updates, or seeds.

## 2. Recovery checkpoint

Immediately before the deployment window, verify a new successful production physical backup or PITR checkpoint. Record UTC timestamp, project ref, retention window, operator, backup health, and restore authority. The 2026-09-14 Phase 14E checkpoint is not sufficient for this later change. STOP if a fresh checkpoint cannot be proven.

## 3. Exact read-only preflight

Use a production password supplied through a protected process environment or secure prompt; never place it on the command line or in evidence. Run:

```powershell
$Psql='C:\Program Files\PostgreSQL\17\bin\psql.exe'
& $Psql -X -w -q -A -t -v ON_ERROR_STOP=1 `
  -f '.\db\responder-local\phase17_production_preflight.sql'
```

Save the one JSON row securely. Require `PHASE17_PRODUCTION_PREFLIGHT_PASS`, read-only `on`, project identity true, both responder schemas absent, reporting false, county rows 254, expected versions/principal, and plausible bounded baseline counts. STOP on any warning, extra row, password prompt in automation, or SQL error.

## 4. Explicit owner approval gate

Present the preflight JSON, fresh recovery checkpoint, clone rehearsal, advisor results, generated migration path, migration SHA, `migration list`, and dry-run to the owner. The owner must authorize that exact commit, timestamped migration file, SHA, project ref, operator, and window. Silence or prior Phase 17 approval is not deployment approval.

## 5. Generate and prove the real migration

```powershell
supabase --version
supabase migration new prepare_responder_production_schema
```

Copy `db/responder-local/phase17_production_migration.sql` byte-for-byte into the one generated file. Do not edit the package in place and do not invent or reuse a timestamp. Then:

```powershell
Get-FileHash -Algorithm SHA256 '.\supabase\migrations\<generated>_prepare_responder_production_schema.sql'
supabase migration list --local
supabase migration list
supabase db push --dry-run
```

The hash must equal the approved package migration SHA, local/remote history must agree through `20260908200554`, and dry-run must show exactly one responder migration. STOP otherwise.

## 6. Exact migration command

Only after the explicit gate, one operator runs exactly once:

```powershell
supabase db push
```

Do not add `--include-seed`, do not use `db reset --linked`, do not paste the SQL into Dashboard, and do not retry automatically. The SQL owns one explicit transaction; any failed embedded precondition or post-DDL assertion aborts it.

## 7. Exact read-only postflight

Copy the six integer counts from preflight into the variables below and run in a new read-only connection:

```powershell
& $Psql -X -w -q -A -t -v ON_ERROR_STOP=1 `
  -v phase17_expected_reports=<preflight_reports> `
  -v phase17_expected_feedback=<preflight_feedback> `
  -v phase17_expected_geocode_cache=<preflight_geocode_cache> `
  -v phase17_expected_geocode_provider_state=<preflight_geocode_provider_state> `
  -v phase17_expected_historical_events=<preflight_historical_events> `
  -v phase17_expected_retention_runs=<preflight_retention_runs> `
  -f '.\db\responder-local\phase17_production_postflight.sql'
```

Require the single `PHASE17_PRODUCTION_POSTFLIGHT_PASS` JSON result. Also run `supabase migration list` and prove the generated timestamp exists once. Save both results.

## 8. Rollback decision tree

1. Migration command failed: do not run rollback blindly. First run the preflight again. If both schemas remain absent, PostgreSQL already rolled back; save evidence and stop.
2. Migration committed and postflight passed: do not roll back merely because Data API is still unconfigured; the zero-activation install is safe.
3. Migration committed but postflight fails: freeze all follow-on configuration. Confirm no responder data exists. With owner authorization for the exact recovery action, run the rollback candidate once.
4. Any responder row exists: rollback SQL will refuse. Preserve/export evidence and prepare a separately reviewed forward recovery migration.
5. Community/Auth/county state differs: stop. Never modify those domains as part of responder rollback.

Rollback command, only after its own owner authorization:

```powershell
& $Psql -X -w -q -A -t -v ON_ERROR_STOP=1 `
  -f '.\db\responder-local\phase17_production_rollback.sql'
```

Migration-history reconciliation after rollback requires a separate reviewed plan. Never use `migration repair` casually.

## 9. Zero-activation certification

Before any Data API change or pilot, require zero organizations, principals, memberships, Gridly admin grants, county authorities, updates, revisions, approvals, activation events, receipts, governance events, invites, and consumer rows. The organization gate defaults false. No runtime route/dashboard integration or responder account may exist.

## 10. Evidence to save

- approved commit and clean status;
- package and generated migration SHA-256;
- CLI version and relevant help output;
- clone versions/rehearsal/tests and staging Advisors;
- fresh recovery checkpoint evidence;
- preflight JSON and UTC time;
- explicit owner authorization reference;
- dry-run and pre/post migration lists;
- `db push` result without credentials;
- postflight JSON and production Advisors;
- confirmation that Data API configuration remains unchanged unless separately authorized.

## 11. STOP conditions

STOP on any identity/version/role/Auth/county/community/catalog mismatch; dirty/partial responder object; migration-history divergence; hash mismatch; more than one pending migration; enabled reporting; missing recovery checkpoint; missing owner approval; unexpected SQL warning/error; nonzero responder data; advisor error; or pressure to expose `agency_private`.

## 12. Do not touch

Do not modify Auth data/schema, county geometry, `public.reports`, `history_capture`, `report_retention`, `gridly_control`, production configuration, responder runtime, main, or the original LP244.26 worktree. Do not enable community reporting or agency publishing. Do not push or merge as part of the database operation unless separately authorized by the owner workflow.
