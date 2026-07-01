# V426 — Historical Production Deployment & One-Event Canary

## Quick Summary

V426 did not mutate production because this execution environment did not expose Supabase project administration credentials, a linked Supabase CLI session, or direct outbound access to the production Supabase REST endpoint. The repository artifacts for V425 remain present and locally validated, including the tracked API schema list, least-privilege migration, rollback migration, writer schema target, and dormant canary controls.

The next verified boundary beyond repository validation is operational access: production configuration and migration application must be performed from an environment that can reach Supabase and has permission to update the Data API exposed schema list and run SQL migrations.

## Exact Production Changes Applied

None from this environment.

Required production changes remain the approved V425 package:

1. Expose only these Supabase/PostgREST API schemas:
   - `public`
   - `graphql_public`
   - `history_capture`
2. Apply `supabase/migrations/202606170425_history_capture_schema_exposure.sql`.
3. Retain `supabase/migrations/202606170426_rollback_history_capture_schema_exposure.sql` as the rollback artifact, but do not execute it unless required.

## Repository Evidence Revalidated

- `supabase/config.toml` tracks the approved PostgREST schema list with `history_capture` included alongside `public` and `graphql_public`.
- `202606170425_history_capture_schema_exposure.sql` grants `anon` schema usage and INSERT-only access to `history_capture.historical_events`, revokes non-insert privileges, preserves monitoring and retention isolation, enables RLS on all historical tables, and creates the scoped Phase 1A insert policy.
- `202606170426_rollback_history_capture_schema_exposure.sql` exists and revokes the V425 writer authorization while preserving RLS.
- The writer test still verifies schema-scoped writes through `schema('history_capture').from('historical_events')`, avoiding default-schema table-name routing.
- The canary controls static test still verifies the canary runtime remains dormant by default.

## Validation Results

Production validation could not be completed from this environment.

| Check | Result | Evidence |
| --- | --- | --- |
| `history_capture` exposed in production | Not verified | Direct REST request could not reach Supabase; tunnel returned HTTP 403 before Supabase/PostgREST response. |
| V425 migration applied in production | Not verified | No service-role, database, or Supabase CLI project credentials/session available. |
| `anon` has schema usage | Not verified | Requires production database privilege inspection. |
| `anon` has INSERT only on `historical_events` | Not verified | Requires production database privilege inspection. |
| `anon` cannot SELECT | Not verified | Requires reachable production PostgREST or database privilege inspection. |
| `anon` cannot UPDATE | Not verified | Requires reachable production PostgREST or database privilege inspection. |
| `anon` cannot DELETE | Not verified | Requires reachable production PostgREST or database privilege inspection. |
| `anon` cannot TRUNCATE | Not verified | Requires production database privilege inspection. |
| Monitoring table inaccessible | Not verified | Requires reachable production PostgREST or database privilege inspection. |
| Retention table inaccessible | Not verified | Requires reachable production PostgREST or database privilege inspection. |
| RLS enabled on all historical tables | Not verified | Requires production database privilege inspection. |
| Scoped insert policy present | Not verified | Requires production database policy inspection. |

## Canary Results

The one-event canary was not executed.

Reason: canary execution depends on the production V425 configuration being applied and validated first. Because production deployment/validation could not be performed from this environment, executing a canary would have violated the requested sequencing and could not produce trustworthy deployment evidence.

Target result remains:

```text
eventsObserved: 1
eventsWritten: 1
writerErrors: 0
protectedSystemsUnchanged: true
```

Observed result from this environment:

```text
eventsObserved: not executed
eventsWritten: not executed
writerErrors: not executed
protectedSystemsUnchanged: true by repository scope; production runtime not mutated
```

## Runtime Diagnostic Output

The requested browser runtime diagnostics were not captured because the canary was not executed:

```js
window.gridlyHistoricalCanaryAudit?.()
window.gridlyHistoricalCanaryStatus?.()
window.gridlyHistoricalWriterDiagnostic?.()
```

Network validation attempt output:

```text
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Wed, 17 Jun 2026 16:06:56 GMT
server: envoy
connection: close
```

## Protected-System Review

No protected system was changed in this V426 execution. The only repository change is this deployment-validation report.

Protected systems remain unchanged by this commit:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Sync

DriveTexas remains designed, validated, governed, and paused. No DriveTexas work was restarted.

## Rollback Recommendation

Do not execute rollback from this environment.

Rollback is not recommended based on V426 evidence because no production mutation was applied here. If a separate production operator applies V425 and then detects permission, RLS, schema exposure, payload validation, or role mismatch failure, use `supabase/migrations/202606170426_rollback_history_capture_schema_exposure.sql` only after capturing exact diagnostics.

## Merge Recommendation

Merge this V426 evidence report if the branch is intended to preserve the deployment attempt and operational boundary. Do not treat this as production validation success. The required next action is to run the approved V425 production deployment from an authorized environment and then perform the single-event canary.
