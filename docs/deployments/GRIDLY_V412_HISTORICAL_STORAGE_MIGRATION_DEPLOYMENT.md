# Gridly V412 Historical Storage Migration Deployment Report

Date: 2026-06-17
Branch: work

## Scope

V412 is limited to deploying the historical storage schema artifact only.

Core rule: Capture Everything. Show Nothing. Depend On Nothing.

## Migration Artifacts

Forward migration selected for deployment:

- `supabase/migrations/202606170410_history_capture_storage.sql`

Rollback artifact retained and not executed:

- `supabase/migrations/202606170411_rollback_history_capture_storage.sql`

## Deployment Command

Project workflow migration deployment command attempted:

```sh
npx supabase db push --include-all
```

Result: deployment did not proceed because the Supabase CLI package could not be fetched in this execution environment. The npm registry request returned `403 Forbidden` for `https://registry.npmjs.org/supabase`.

A direct Supabase reachability check was also attempted:

```sh
curl -sS -i --max-time 20 'https://nhwhkbkludzkuyxmkkcj.supabase.co/rest/v1/'
```

Result: outbound CONNECT tunnel failed with `403 Forbidden` before reaching the Supabase REST API.

## Deployment Result

Schema Deployed: NO in this execution environment.

The V410 forward migration was not applied from this container because required Supabase deployment access/tooling was unavailable. The rollback migration was not executed.

## Static Migration Verification

The forward migration defines the `history_capture` schema and the expected tables:

- `history_capture.historical_events`
- `history_capture.writer_monitoring_events`
- `history_capture.retention_runs`

The forward migration enables row level security on all three V410 tables.

The forward migration defines the designed indexes:

- `historical_events_event_type_observed_at_idx`
- `historical_events_source_report_id_idx`
- `historical_events_retained_until_idx`
- `writer_monitoring_events_created_at_idx`

## Runtime Safety Confirmation

No runtime files were modified for this deployment report.

Capture remains disabled by default in the existing history capture flags module.

Writer remains disabled unless explicitly enabled in writer call options; V412 does not enable those options.

Historical writes remain absent from normal runtime because capture is disabled and this milestone made no runtime activation change.

Historical reads and history UI remain absent from this milestone because no runtime read path or UI/DOM changes were added.

Production historical collection remains inactive.

## Required Checks Run

```sh
node --check js/app.js
```

```sh
for f in js/history-capture/*.js; do node --check "$f"; done
```

```sh
for f in tests/history-capture/*.test.js; do node "$f"; done
```

```sh
git diff --check
```

```sh
rg -n "captureEnabled:\\s*true|writerEnabled:\\s*true|writesEnabled\\s*=\\s*true" js/app.js js/history-capture tests/history-capture
```

```sh
rg -n "history_capture\\.historical_events|select\\(" js/app.js js/history-capture tests/history-capture supabase/migrations/202606170410_history_capture_storage.sql
```

## Post-Deployment State From This Run

- Schema Deployed: NO
- Capture Enabled: NO
- Writer Enabled: NO
- Historical Writes: NO runtime activation added
- Historical Reads: NO
- History UI: NO
- Production Activation: NO
